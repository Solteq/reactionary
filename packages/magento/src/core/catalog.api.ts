import type { Cache, RequestContext } from '@reactionary/core';
import createDebug from 'debug';
import type * as z from 'zod';
import type { MagentoClient } from './client.js';
import { PRODUCT_AGGREGATIONS_QUERY } from './catalog.graphql.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import {
  MagentoAttributeCatalogSchema,
  MagentoAttributeMetadataSchema,
  MagentoCachedKeySchema,
  MagentoProductAggregationsResponseSchema,
  MagentoRestAttributeOptionListSchema,
  MagentoRestProductAttributeListSchema,
  type MagentoAggregation,
  type MagentoAttributeCatalog,
  type MagentoAttributeMetadata,
  type MagentoAttributeOption,
  type MagentoRestAttributeOption,
  type MagentoRestProductAttribute,
} from '../schema/catalog.types.js';
import type {
  MagentoCategory,
  MagentoCategorySearchResult,
  MagentoProduct,
} from '../schema/magento.types.js';
import { getCategoryKey } from '../utils/magento-category.js';
import { resolveMagentoStoreViewCodeForContext } from '../utils/magento-store-view.js';

const debug = createDebug('reactionary:magento:catalog');

/** The REST `searchCriteria` condition types used by the provider. */
export type MagentoConditionType =
  | 'eq'
  | 'neq'
  | 'in'
  | 'nin'
  | 'like'
  | 'gteq'
  | 'lteq'
  | 'gt'
  | 'lt'
  | 'finset';

export interface MagentoSearchFilter {
  field: string;
  value: string;
  conditionType: MagentoConditionType;
}

/** Magento ORs the filters within a group and ANDs the groups. */
export type MagentoFilterGroup = MagentoSearchFilter[];

export interface MagentoSortOrder {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface MagentoSearchCriteriaOptions {
  pageSize?: number;
  currentPage?: number;
  sortOrders?: MagentoSortOrder[];
}

/** Product `status`: 1 = enabled, 2 = disabled. */
export const MAGENTO_PRODUCT_STATUS_ENABLED = '1';

/** Product `visibility` values. */
export const MagentoVisibility = {
  NotVisibleIndividually: 1,
  Catalog: 2,
  Search: 3,
  CatalogSearch: 4,
} as const;

/** Product types that cannot be added to a cart without choosing options first. */
export const MAGENTO_COMPOSITE_PRODUCT_TYPES = ['configurable', 'bundle', 'grouped'];

/** Attribute codes the brand / manufacturer of a product is read from, in order. */
export const MAGENTO_BRAND_ATTRIBUTE_CODES = ['brand', 'manufacturer'];

/** Builds the `searchCriteria` query string of a Magento REST list endpoint. */
export function buildSearchCriteria(
  groups: MagentoFilterGroup[],
  options: MagentoSearchCriteriaOptions = {},
): URLSearchParams {
  const params = new URLSearchParams();
  groups
    .filter((group) => group.length > 0)
    .forEach((filters, groupIndex) => {
      filters.forEach((filter, filterIndex) => {
        const prefix = `searchCriteria[filterGroups][${groupIndex}][filters][${filterIndex}]`;
        params.set(`${prefix}[field]`, filter.field);
        params.set(`${prefix}[value]`, filter.value);
        params.set(`${prefix}[condition_type]`, filter.conditionType);
      });
    });
  (options.sortOrders ?? []).forEach((sortOrder, index) => {
    params.set(`searchCriteria[sortOrders][${index}][field]`, sortOrder.field);
    params.set(`searchCriteria[sortOrders][${index}][direction]`, sortOrder.direction);
  });
  if (options.pageSize !== undefined) {
    params.set('searchCriteria[pageSize]', String(options.pageSize));
  }
  if (options.currentPage !== undefined) {
    params.set('searchCriteria[currentPage]', String(options.currentPage));
  }
  return params;
}

/**
 * Escapes the SQL `LIKE` wildcards in user input, so a term containing `%` or
 * `_` matches them literally (MySQL's default escape character is `\`).
 */
export function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Filter groups restricting a product query to enabled products with one of the given visibilities. */
export function storefrontProductFilterGroups(visibilities: number[]): MagentoFilterGroup[] {
  return [
    [{ field: 'status', value: MAGENTO_PRODUCT_STATUS_ENABLED, conditionType: 'eq' }],
    [{ field: 'visibility', value: visibilities.join(','), conditionType: 'in' }],
  ];
}

/** True when Magento reports the product as enabled (missing status counts as enabled). */
export function isProductEnabled(product: MagentoProduct): boolean {
  return product.status === undefined || String(product.status) === MAGENTO_PRODUCT_STATUS_ENABLED;
}

function toLabel(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function normalizeOptions(options: MagentoRestAttributeOption[] | null | undefined): MagentoAttributeOption[] {
  const result: MagentoAttributeOption[] = [];
  for (const option of options ?? []) {
    const value = option.value === null || option.value === undefined ? '' : String(option.value);
    const label = toLabel(option.label);
    // Magento lists an empty placeholder option first for selects.
    if (value === '' || label === '') continue;
    result.push({ value, label });
  }
  return result;
}

function normalizeAttribute(attribute: MagentoRestProductAttribute): MagentoAttributeMetadata {
  return {
    attributeId: attribute.attribute_id === undefined ? '' : String(attribute.attribute_id),
    code: attribute.attribute_code,
    label: toLabel(attribute.default_frontend_label) || attribute.attribute_code,
    frontendInput: attribute.frontend_input ?? '',
    visibleOnFront: attribute.is_visible_on_front,
    userDefined: attribute.is_user_defined,
    options: normalizeOptions(attribute.options),
  };
}

const ATTRIBUTE_CACHE_TTL_SECONDS = 60 * 60;
const CATEGORY_KEY_CACHE_TTL_SECONDS = 60 * 60;

/**
 * Catalog lookups shared by the product, product search and category
 * capabilities. Everything here is a read over the catalog transport
 * (integration token) except the facet aggregations, which go through the
 * storefront GraphQL endpoint.
 */
export class MagentoCatalogApi {
  constructor(
    protected magentoApi: MagentoClient,
    protected cache: Cache,
    protected config: MagentoConfiguration,
    protected context: RequestContext,
  ) {}

  protected get storeViewCode(): string {
    return resolveMagentoStoreViewCodeForContext(this.config.storeBaseCode, this.context);
  }

  /** A cache read that treats a stale or foreign entry as a miss instead of failing the request. */
  protected async readCache<T extends Record<string, unknown>>(
    key: string,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    try {
      return await this.cache.get(key, schema);
    } catch (e) {
      debug(`Ignoring unreadable cache entry ${key}: %O`, e);
      return null;
    }
  }

  // ---------------------------------------------------------------- attributes

  /**
   * The metadata of every attribute in an attribute set, in the request's
   * store view. Cached per store view and set. Throws when Magento refuses
   * the call (e.g. the integration lacks the `Magento_Catalog::sets` ACL).
   */
  public async getAttributeSetMetadata(attributeSetId: number): Promise<MagentoAttributeMetadata[]> {
    const cacheKey = `magento:attribute-set:${this.storeViewCode}:${attributeSetId}`;
    const cached = await this.readCache(cacheKey, MagentoAttributeCatalogSchema);
    if (cached) {
      return cached.attributes;
    }

    const response = await this.magentoApi.catalogRequest<unknown>(
      `/V1/products/attribute-sets/${encodeURIComponent(String(attributeSetId))}/attributes`,
    );
    const attributes = MagentoRestProductAttributeListSchema.parse(response).map(normalizeAttribute);

    await this.cache.put(cacheKey, { complete: true, attributes } satisfies MagentoAttributeCatalog, {
      ttlSeconds: ATTRIBUTE_CACHE_TTL_SECONDS,
      dependencyIds: [`magento:attribute-set:${attributeSetId}`],
    });
    return attributes;
  }

  /** The options of one select/multiselect attribute, cached per store view. */
  public async getAttributeOptions(attributeCode: string): Promise<MagentoAttributeOption[]> {
    const cacheKey = `magento:attribute-options:${this.storeViewCode}:${attributeCode}`;
    const cached = await this.readCache(cacheKey, MagentoAttributeMetadataSchema);
    if (cached) {
      return cached.options;
    }

    const response = await this.magentoApi.catalogRequest<unknown>(
      `/V1/products/attributes/${encodeURIComponent(attributeCode)}/options`,
    );
    const options = normalizeOptions(MagentoRestAttributeOptionListSchema.parse(response));
    const entry: MagentoAttributeMetadata = {
      attributeId: '',
      code: attributeCode,
      label: attributeCode,
      frontendInput: 'select',
      visibleOnFront: false,
      userDefined: true,
      options,
    };
    await this.cache.put(cacheKey, entry, {
      ttlSeconds: ATTRIBUTE_CACHE_TTL_SECONDS,
      dependencyIds: [`magento:attribute:${attributeCode}`],
    });
    return options;
  }

  /**
   * The attribute metadata for a product. Prefers the product's whole
   * attribute set; when that cannot be read, falls back to resolving just the
   * brand/manufacturer option labels so those never surface as raw option ids.
   */
  public async getAttributeCatalog(product: MagentoProduct): Promise<MagentoAttributeCatalog> {
    if (product.attribute_set_id !== undefined) {
      try {
        return {
          complete: true,
          attributes: await this.getAttributeSetMetadata(product.attribute_set_id),
        };
      } catch (e) {
        debug(`Attribute set ${product.attribute_set_id} metadata unavailable, falling back: %O`, e);
      }
    }

    const presentCodes = new Set((product.custom_attributes ?? []).map((a) => a.attribute_code));
    const attributes: MagentoAttributeMetadata[] = [];
    for (const code of MAGENTO_BRAND_ATTRIBUTE_CODES.filter((c) => presentCodes.has(c))) {
      try {
        attributes.push({
          attributeId: '',
          code,
          label: code,
          frontendInput: 'select',
          visibleOnFront: false,
          userDefined: true,
          options: await this.getAttributeOptions(code),
        });
      } catch (e) {
        debug(`Options of attribute ${code} unavailable: %O`, e);
      }
    }
    return { complete: false, attributes };
  }

  // ---------------------------------------------------------------- categories

  public async listCategories(
    groups: MagentoFilterGroup[],
    options: MagentoSearchCriteriaOptions = {},
  ): Promise<MagentoCategorySearchResult> {
    const params = buildSearchCriteria(groups, options);
    return this.magentoApi.catalogRequest<MagentoCategorySearchResult>(
      `/V1/categories/list?${params.toString()}`,
    );
  }

  /** Filter groups restricting a category query to active categories in the configured store tree. */
  public storefrontCategoryFilterGroups(): MagentoFilterGroup[] {
    return [
      [{ field: 'is_active', value: '1', conditionType: 'eq' }],
      [{ field: 'path', value: `%/${this.config.rootCategoryId}/%`, conditionType: 'like' }],
    ];
  }

  protected async rememberCategory(category: MagentoCategory): Promise<void> {
    await this.storeCategoryMapping(getCategoryKey(category), String(category.id));
  }

  /** Caches a category key ↔ entity id pair. Only real matches are ever cached. */
  public async storeCategoryMapping(key: string, id: string): Promise<void> {
    await this.cache.put(`magento:category-id:${key}`, { value: id }, {
      ttlSeconds: CATEGORY_KEY_CACHE_TTL_SECONDS,
      dependencyIds: [`category_key:${key}`],
    });
    await this.cache.put(`magento:category-key:${id}`, { value: key }, {
      ttlSeconds: CATEGORY_KEY_CACHE_TTL_SECONDS,
      dependencyIds: [`category_id:${id}`],
    });
  }

  /**
   * Translates category entity ids into category keys (see `getCategoryKey`).
   * Ids Magento does not know are left out of the result.
   */
  public async resolveCategoryKeys(ids: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const cached = await this.readCache(`magento:category-key:${id}`, MagentoCachedKeySchema);
      if (cached) {
        result[id] = cached.value;
      } else if (/^\d+$/.test(id)) {
        missing.push(id);
      }
    }
    if (missing.length === 0) {
      return result;
    }

    const response = await this.listCategories(
      [[{ field: 'entity_id', value: missing.join(','), conditionType: 'in' }]],
      { pageSize: missing.length, currentPage: 1 },
    );
    for (const category of response.items ?? []) {
      result[String(category.id)] = getCategoryKey(category);
      await this.rememberCategory(category);
    }
    return result;
  }

  /**
   * Translates category keys into Magento entity ids. A key is first matched
   * against `external_id`; a numeric key that matches none is accepted as an
   * entity id only when that category carries no `external_id` of its own, so
   * the translation is the exact inverse of `getCategoryKey`. Unknown keys are
   * left out of the result.
   */
  public async resolveCategoryIds(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    let missing: string[] = [];
    for (const key of new Set(keys)) {
      const cached = await this.readCache(`magento:category-id:${key}`, MagentoCachedKeySchema);
      if (cached) {
        result[key] = cached.value;
      } else {
        missing.push(key);
      }
    }
    if (missing.length === 0) {
      return result;
    }

    const byExternalId = await this.listCategories(
      [[{ field: 'external_id', value: missing.join(','), conditionType: 'in' }]],
      { pageSize: missing.length, currentPage: 1 },
    );
    for (const category of byExternalId.items ?? []) {
      const key = getCategoryKey(category);
      if (missing.includes(key)) {
        result[key] = String(category.id);
        await this.rememberCategory(category);
      }
    }

    missing = missing.filter((key) => result[key] === undefined && /^\d+$/.test(key));
    if (missing.length === 0) {
      return result;
    }

    const byEntityId = await this.listCategories(
      [[{ field: 'entity_id', value: missing.join(','), conditionType: 'in' }]],
      { pageSize: missing.length, currentPage: 1 },
    );
    for (const category of byEntityId.items ?? []) {
      const key = getCategoryKey(category);
      if (key === String(category.id) && missing.includes(key)) {
        result[key] = key;
        await this.rememberCategory(category);
      }
    }
    return result;
  }

  /**
   * Finds the category a key refers to (see `resolveCategoryIds`), restricted
   * to the given extra filter groups, e.g. `storefrontCategoryFilterGroups()`.
   */
  public async findCategoryByKey(
    key: string,
    extraGroups: MagentoFilterGroup[] = [],
  ): Promise<MagentoCategory | null> {
    const ids = await this.resolveCategoryIds([key]);
    const id = ids[key];
    if (id === undefined) {
      return null;
    }
    const response = await this.listCategories(
      [[{ field: 'entity_id', value: id, conditionType: 'eq' }], ...extraGroups],
      { pageSize: 1, currentPage: 1 },
    );
    return response.items?.[0] ?? null;
  }

  // ---------------------------------------------------------------- facets

  /**
   * The layered-navigation aggregations for a storefront product query, read
   * over GraphQL (anonymous or with the shopper's token).
   */
  public async getProductAggregations(
    search: string | undefined,
    filter: Record<string, unknown>,
  ): Promise<MagentoAggregation[]> {
    const variables: Record<string, unknown> = { filter };
    if (search) {
      variables['search'] = search;
    }
    const response = await this.magentoApi.graphqlRequest<unknown>(PRODUCT_AGGREGATIONS_QUERY, variables);
    return MagentoProductAggregationsResponseSchema.parse(response).products?.aggregations ?? [];
  }
}
