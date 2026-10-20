import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  ProductSearchSortWellKnownFieldSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type InvalidInputError,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  type ProductSearchResultItemVariant,
  type ProductSearchSortWellKnownField,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import {
  MagentoCatalogApi,
  MagentoVisibility,
  buildSearchCriteria,
  escapeLikeValue,
  storefrontProductFilterGroups,
  type MagentoFilterGroup,
  type MagentoSortOrder,
} from '../core/catalog.api.js';
import {
  MagentoAggregationSchema,
  type MagentoAggregation,
  type MagentoProductSearchDetails,
} from '../schema/catalog.types.js';
import type { MagentoProduct } from '../schema/magento.types.js';
import { buildProductSearchResultItemVariant } from '../utils/magento-product.js';
import type { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MAGENTO_CATEGORY_FACET_KEY } from '../utils/magento-category.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:search');

const CATEGORY_FIELD = 'category_id';
const PRICE_FIELD = 'price';
const ATTRIBUTE_CODE_PATTERN = /^[a-z_][a-z0-9_]*$/i;
/** A sort field passed through to Magento as an attribute code. */
const SORT_ATTRIBUTE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;
/**
 * The REST sort field per well-known core sort field; `undefined` keeps
 * Magento's default order (REST has no relevance score to sort by).
 */
const WELL_KNOWN_SORT_FIELDS: Record<ProductSearchSortWellKnownField, string | undefined> = {
  relevance: undefined,
  name: 'name',
  price: 'price',
  createdAt: 'created_at',
};
/** A layered-navigation price bucket: `10_20`, `*_10`, `100_*`. */
const PRICE_RANGE_PATTERN = /^(\*|\d+(?:\.\d+)?)_(\*|\d+(?:\.\d+)?)$/;

/** An attribute filter read from `search.filters` or a selected facet. */
export interface MagentoAttributeFilter {
  code: string;
  values: string[];
}

interface MagentoPriceRange {
  from?: string;
  to?: string;
}

/**
 * Product search over the REST product list (catalog transport), with the
 * facets read from the GraphQL `products { aggregations }` query.
 *
 * Identifiers:
 * - result items are keyed by `getProductKey` (external_id → entity id);
 * - facet keys are attribute codes and facet value keys the stored values
 *   (option ids for select attributes, `from_to` buckets for price);
 * - the category facet (`categories`) and `categoryFilter` carry category
 *   keys (external_id → entity id), translated to entity ids per query.
 *
 * `search.filters` entries use `attribute_code:value[,value...]` (or `=`).
 * `search.sort` maps the well-known fields onto REST sort orders (`relevance`
 * keeps the default order) and passes other fields through as attribute codes.
 * `company` and `personalizationProfile` are not used: Magento's REST
 * product list has no shared-catalog or personalization scope.
 */
/**
 * Magento's REST sort is not stable across ties (e.g. equal prices), so pages
 * could repeat or skip items; `entity_id` makes the order total.
 */
function withStableTieBreaker(orders: MagentoSortOrder[]): MagentoSortOrder[] {
  if (orders.some((order) => order.field === 'entity_id')) {
    return orders;
  }
  return [...orders, { field: 'entity_id', direction: 'ASC' }];
}

export class MagentoProductSearchCapability<
  TFactory extends ProductSearchFactory = MagentoProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;
  protected catalog: MagentoCatalogApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.catalog = new MagentoCatalogApi(magentoApi, cache, config, context);
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const term = this.normalizeTerm(payload.search.term);
    const pageSize = payload.search.paginationOptions.pageSize;
    const currentPage = payload.search.paginationOptions.pageNumber;

    const filters = this.parseFilters(payload.search.filters);
    if (!Array.isArray(filters)) {
      return error<InvalidInputError>(filters);
    }

    const sortOrders = this.getSortOrders(payload);
    if (!Array.isArray(sortOrders)) {
      return error<InvalidInputError>(sortOrders);
    }

    try {
      const categoryFacetKeys = payload.search.facets
        .filter((facet) => facet.facet.key === MAGENTO_CATEGORY_FACET_KEY)
        .map((facet) => facet.key);
      const categoryFilterKey = payload.search.categoryFilter?.key;
      const categoryIds = await this.catalog.resolveCategoryIds(
        categoryFilterKey ? [categoryFilterKey, ...categoryFacetKeys] : categoryFacetKeys,
      );

      const categoryFilterId = categoryFilterKey ? categoryIds[categoryFilterKey] : undefined;
      const categoryFacetIds = categoryFacetKeys
        .map((key) => categoryIds[key])
        .filter((id): id is string => id !== undefined);

      // An unknown category matches nothing, rather than silently widening to the whole catalog.
      if (
        (categoryFilterKey && categoryFilterId === undefined) ||
        (categoryFacetKeys.length > 0 && categoryFacetIds.length === 0)
      ) {
        debug(`Unknown category in search: ${[categoryFilterKey, ...categoryFacetKeys].join(', ')}`);
        return success(
          this.factory.parseSearchResult(
            this.context,
            { result: { items: [], total_count: 0 } } satisfies MagentoProductSearchDetails,
            payload,
          ),
        );
      }

      const attributeFilters = [...filters, ...this.getAttributeFacetFilters(payload.search.facets)];

      const groups: MagentoFilterGroup[] = [];
      if (term) {
        const like = `%${escapeLikeValue(term)}%`;
        groups.push([
          { field: 'name', value: like, conditionType: 'like' },
          { field: 'sku', value: like, conditionType: 'like' },
        ]);
      }
      if (categoryFilterId !== undefined) {
        groups.push([{ field: CATEGORY_FIELD, value: categoryFilterId, conditionType: 'eq' }]);
      }
      if (categoryFacetIds.length > 0) {
        // Magento's category_id filter ANDs the filters of a group, so the OR is a single `in`.
        groups.push([{ field: CATEGORY_FIELD, value: categoryFacetIds.join(','), conditionType: 'in' }]);
      }
      groups.push(...this.getAttributeFilterGroups(attributeFilters));
      groups.push(...this.getStorefrontScopeFilterGroups(term.length > 0));

      const params = buildSearchCriteria(groups, {
        pageSize,
        currentPage,
        sortOrders,
      });

      const [response, facets] = await Promise.all([
        this.magentoApi.searchProducts(params),
        this.loadFacets(term, categoryFilterId, categoryFacetIds, attributeFilters),
      ]);

      const result = this.factory.parseSearchResult(
        this.context,
        {
          result: response,
          aggregations: facets?.aggregations,
          categoryKeys: facets?.categoryKeys,
        } satisfies MagentoProductSearchDetails,
        payload,
      );

      if (debug.enabled) {
        debug(
          `Search for term "${payload.search.term}" returned ${response.items?.length ?? 0} of ${response.total_count ?? 0} products (page ${currentPage})`,
        );
      }

      return success(result);
    } catch (e) {
      return handleMagentoProviderError('search products', e, payload.search);
    }
  }

  /** Trims the term and drops every `*` wildcard (Magento matches substrings anyway). */
  protected normalizeTerm(term: string | undefined): string {
    return (term || '').replace(/\*/g, '').trim();
  }

  /**
   * Parses `search.filters`: `attribute_code:value` or `attribute_code=value`,
   * with several values separated by commas (OR-ed).
   */
  protected parseFilters(filters: string[]): MagentoAttributeFilter[] | InvalidInputError {
    const parsed: MagentoAttributeFilter[] = [];
    for (const raw of filters) {
      const match = /^\s*([^:=\s]+)\s*[:=]\s*(.+?)\s*$/.exec(raw);
      const code = match?.[1];
      const values = (match?.[2] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (!code || !ATTRIBUTE_CODE_PATTERN.test(code) || values.length === 0) {
        return {
          type: 'InvalidInput',
          error: `Unsupported search filter "${raw}". Expected "attribute_code:value[,value...]".`,
        };
      }
      parsed.push({ code, values });
    }
    return parsed;
  }

  /** The selected non-category facets, grouped per facet (attribute code). */
  protected getAttributeFacetFilters(facets: FacetValueIdentifier[]): MagentoAttributeFilter[] {
    const byCode = new Map<string, string[]>();
    for (const facetValue of facets) {
      const code = facetValue.facet.key;
      if (code === MAGENTO_CATEGORY_FACET_KEY) continue;
      byCode.set(code, [...(byCode.get(code) ?? []), facetValue.key]);
    }
    return [...byCode.entries()].map(([code, values]) => ({ code, values }));
  }

  /**
   * One filter group per attribute: values of one attribute widen the result
   * (OR within the group) and distinct attributes narrow it (AND between
   * groups). Price buckets become a `gteq`/`lt` range.
   */
  protected getAttributeFilterGroups(filters: MagentoAttributeFilter[]): MagentoFilterGroup[] {
    const groups: MagentoFilterGroup[] = [];
    for (const filter of filters) {
      const range = filter.code === PRICE_FIELD ? this.parsePriceRange(filter.values) : undefined;
      if (range) {
        if (range.from !== undefined) {
          groups.push([{ field: PRICE_FIELD, value: range.from, conditionType: 'gteq' }]);
        }
        if (range.to !== undefined) {
          groups.push([{ field: PRICE_FIELD, value: range.to, conditionType: 'lt' }]);
        }
        continue;
      }
      groups.push(filter.values.map((value) => ({ field: filter.code, value, conditionType: 'eq' })));
    }
    return groups;
  }

  /**
   * The envelope of the selected price buckets (REST cannot OR ranges), or
   * undefined when the values are not price buckets.
   */
  protected parsePriceRange(values: string[]): MagentoPriceRange | undefined {
    const ranges = values.map((value) => PRICE_RANGE_PATTERN.exec(value));
    if (ranges.length === 0 || ranges.some((range) => range === null)) {
      return undefined;
    }
    const froms: number[] = [];
    const tos: number[] = [];
    let openFrom = false;
    let openTo = false;
    for (const range of ranges) {
      if (!range) continue;
      if (range[1] === '*') openFrom = true;
      else froms.push(Number(range[1]));
      if (range[2] === '*') openTo = true;
      else tos.push(Number(range[2]));
    }
    return {
      from: openFrom || froms.length === 0 ? undefined : String(Math.min(...froms)),
      to: openTo || tos.length === 0 ? undefined : String(Math.max(...tos)),
    };
  }

  /**
   * @deprecated Category facets need an asynchronous key → id translation and
   * are handled in `queryByTerm`; this returns the groups of the attribute facets only.
   */
  protected getFacetFilterGroups(facets: FacetValueIdentifier[]): MagentoFilterGroup[] {
    return this.getAttributeFilterGroups(this.getAttributeFacetFilters(facets));
  }

  /**
   * Restricts results to what a storefront may list: enabled products that
   * are visible in the catalog (2 = Catalog, 4 = Catalog, Search) when
   * browsing, or in search (3 = Search, 4) when a term is given. The admin
   * REST product search does not apply this itself.
   */
  protected getStorefrontScopeFilterGroups(isTermSearch = false): MagentoFilterGroup[] {
    return storefrontProductFilterGroups(
      isTermSearch
        ? [MagentoVisibility.Search, MagentoVisibility.CatalogSearch]
        : [MagentoVisibility.Catalog, MagentoVisibility.CatalogSearch],
    );
  }

  /**
   * The REST sort orders for `search.sort`: `name`, `price` and `createdAt`
   * map to `name`, `price` and `created_at`; `relevance` (or no sort) keeps
   * Magento's default order; any other field is used as an attribute code.
   * Override to change the mapping or add tie-breakers.
   */
  protected getSortOrders(payload: ProductSearchQueryByTerm): MagentoSortOrder[] | InvalidInputError {
    const sort = payload.search.sort;
    if (!sort) {
      return [];
    }

    const direction = sort.direction === 'desc' ? 'DESC' : 'ASC';
    const wellKnown = ProductSearchSortWellKnownFieldSchema.safeParse(sort.field);
    if (wellKnown.success) {
      const field = WELL_KNOWN_SORT_FIELDS[wellKnown.data];
      return field ? withStableTieBreaker([{ field, direction }]) : [];
    }

    if (!SORT_ATTRIBUTE_CODE_PATTERN.test(sort.field)) {
      return {
        type: 'InvalidInput',
        error: `Unsupported sort field "${sort.field}". Expected relevance, name, price, createdAt or an attribute code.`,
      };
    }
    return withStableTieBreaker([{ field: sort.field, direction }]);
  }

  /**
   * Reads the facets for the query from GraphQL and translates the category
   * buckets to category keys. Facets are auxiliary: when GraphQL is
   * unavailable or rejects the filter, the search still returns its items,
   * without facets.
   */
  protected async loadFacets(
    term: string,
    categoryFilterId: string | undefined,
    categoryFacetIds: string[],
    attributeFilters: MagentoAttributeFilter[],
  ): Promise<{ aggregations: MagentoAggregation[]; categoryKeys: Record<string, string> } | undefined> {
    try {
      const filter: Record<string, unknown> = {};
      if (categoryFacetIds.length > 0) {
        filter[CATEGORY_FIELD] = { in: categoryFacetIds };
      } else if (categoryFilterId !== undefined) {
        filter[CATEGORY_FIELD] = { eq: categoryFilterId };
      }
      for (const attributeFilter of attributeFilters) {
        const range =
          attributeFilter.code === PRICE_FIELD ? this.parsePriceRange(attributeFilter.values) : undefined;
        filter[attributeFilter.code] = range ?? { in: attributeFilter.values };
      }

      const aggregations = await this.catalog.getProductAggregations(term || undefined, filter);

      const categoryIds: string[] = [];
      for (const aggregation of aggregations) {
        if (aggregation.attribute_code === 'category_id') {
          categoryIds.push(...(aggregation.options ?? []).map((option) => option.value));
        } else if (aggregation.attribute_code === 'category_uid') {
          categoryIds.push(...(aggregation.options ?? []).map((option) => this.decodeUid(option.value)));
        }
      }
      const categoryKeys = await this.catalog.resolveCategoryKeys(categoryIds);

      return { aggregations, categoryKeys };
    } catch (e) {
      debug('Facet aggregation failed; returning results without facets: %O', e);
      return undefined;
    }
  }

  protected decodeUid(uid: string): string {
    try {
      return atob(uid);
    } catch {
      return uid;
    }
  }

  /** Maps a GraphQL aggregation (validated) onto a facet; see `MagentoProductSearchFactory.parseFacet`. */
  protected parseFacet(
    facetIdentifier: FacetIdentifier,
    facetValue: unknown,
  ): ProductSearchResultFacet {
    const aggregation = MagentoAggregationSchema.parse(facetValue);
    return ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: aggregation.label || aggregation.attribute_code,
      values: (aggregation.options ?? []).map((option) =>
        this.parseFacetValue(
          FacetValueIdentifierSchema.parse({ facet: facetIdentifier, key: option.value }),
          option.label || option.value,
          option.count ?? 0,
        ),
      ),
    } satisfies ProductSearchResultFacet);
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number,
  ): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count,
      active: false,
    } satisfies ProductSearchResultFacetValue);
  }

  protected parseVariant(variant: MagentoProduct, product: MagentoProduct = variant): ProductSearchResultItemVariant {
    return buildProductSearchResultItemVariant(this.config, variant, product);
  }

  /**
   * The category navigation facet for the leaf of a breadcrumb path. Its value
   * is the leaf's category key, translated to the entity id at query time.
   */
  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>> {
    const leaf = payload.categoryPath[payload.categoryPath.length - 1];
    if (!leaf) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'A category navigation filter needs a non-empty category path.',
      });
    }

    const facetIdentifier = FacetIdentifierSchema.parse({
      key: MAGENTO_CATEGORY_FACET_KEY,
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: leaf.identifier.key,
    });

    return success(facetValueIdentifier);
  }
}
