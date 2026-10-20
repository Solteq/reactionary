import type {
  Cache,
  CategoryFactory,
  CategoryFactoryCategoryOutput,
  CategoryFactoryPaginatedOutput,
  CategoryFactoryWithOutput,
} from '@reactionary/core';
import {
  CategoryCapability,
  CategoryPaginatedResultSchema,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  error,
  Reactionary,
  success,
  type CategoryQueryById,
  type CategoryQueryBySlug,
  type CategoryQueryForBreadcrumb,
  type CategoryQueryForChildCategories,
  type CategoryQueryForTopCategories,
  type NotFoundError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import * as z from 'zod';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { Magento, MagentoClient } from '../core/client.js';
import { MagentoCatalogApi, type MagentoFilterGroup } from '../core/catalog.api.js';
import type { MagentoCategoryFactory } from '../factories/category/category.factory.js';
import type { MagentoCategory, MagentoCategorySearchResult } from '../schema/magento.types.js';
import type { MagentoResolvedCategory } from '../schema/catalog.types.js';
import { getCategoryPathBelowRoot } from '../utils/magento-category.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

/**
 * Categories are keyed by `getCategoryKey`: the `external_id` attribute,
 * falling back to the Magento entity id. All lookups are restricted to active
 * categories beneath the configured `rootCategoryId`.
 */
export class MagentoCategoryCapability<
  TFactory extends CategoryFactory = MagentoCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryFactoryPaginatedOutput<TFactory>
> {
  protected config: MagentoConfiguration;
  protected factory: CategoryFactoryWithOutput<TFactory>;
  protected catalog: MagentoCatalogApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CategoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.catalog = new MagentoCatalogApi(magentoApi, cache, config, context);
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    try {
      const category = await this.catalog.findCategoryByKey(
        payload.id.key,
        this.catalog.storefrontCategoryFilterGroups(),
      );
      if (!category) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.id });
      }
      const [resolved] = await this.resolveParentKeys([category]);
      return success(this.factory.parseCategory(this.context, resolved));
    } catch (e) {
      return handleMagentoProviderError('get category by id', e, payload.id);
    }
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    try {
      const response = await this.catalog.listCategories(
        [
          [{ field: 'url_key', value: payload.slug, conditionType: 'eq' }],
          ...this.catalog.storefrontCategoryFilterGroups(),
        ],
        { pageSize: 1, currentPage: 1 },
      );
      const category = response.items?.[0];
      if (!category) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload });
      }
      const [resolved] = await this.resolveParentKeys([category]);
      return success(this.factory.parseCategory(this.context, resolved));
    } catch (e) {
      return handleMagentoProviderError('get category by slug', e, payload);
    }
  }

  /**
   * The active categories from the store root down to the requested one, read
   * from the category `path`. Inactive ancestors are left out.
   */
  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>[]>> {
    try {
      const category = await this.catalog.findCategoryByKey(
        payload.id.key,
        this.catalog.storefrontCategoryFilterGroups(),
      );
      const pathIds = category ? getCategoryPathBelowRoot(category, this.config.rootCategoryId) : null;
      if (!category || !pathIds || pathIds.length === 0) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.id });
      }

      const response = await this.catalog.listCategories(
        [
          [{ field: 'entity_id', value: pathIds.join(','), conditionType: 'in' }],
          [{ field: 'is_active', value: '1', conditionType: 'eq' }],
        ],
        { pageSize: pathIds.length, currentPage: 1 },
      );
      const byId = new Map((response.items ?? []).map((item) => [String(item.id), item]));
      const path = pathIds
        .map((id) => byId.get(id))
        .filter((item): item is MagentoCategory => item !== undefined);

      const resolved = await this.resolveParentKeys(path);
      return success(resolved.map((item) => this.factory.parseCategory(this.context, item)));
    } catch (e) {
      return handleMagentoProviderError('get category breadcrumb', e, payload.id);
    }
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    try {
      const parentKey = payload.parentId.key;
      const parentId = (await this.catalog.resolveCategoryIds([parentKey]))[parentKey];
      if (parentId === undefined) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.parentId });
      }

      const response = await this.listActiveChildren(parentId, payload);
      return success(
        this.factory.parseCategoryPaginatedResult(
          this.context,
          {
            ...response,
            items: (response.items ?? []).map((item) => ({ ...item, parentKey })),
            pageSize: payload.paginationOptions.pageSize,
            currentPage: payload.paginationOptions.pageNumber,
          },
          payload,
        ),
      );
    } catch (e) {
      return handleMagentoProviderError('find child categories', e, payload.parentId);
    }
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    try {
      const response = await this.listActiveChildren(this.config.rootCategoryId, payload);
      return success(
        this.factory.parseCategoryPaginatedResult(
          this.context,
          {
            ...response,
            items: (response.items ?? []).map((item) => ({ ...item, parentKey: null })),
            pageSize: payload.paginationOptions.pageSize,
            currentPage: payload.paginationOptions.pageNumber,
          },
          payload,
        ),
      );
    } catch (e) {
      return handleMagentoProviderError('find top categories', e);
    }
  }

  protected async listActiveChildren(
    parentId: string,
    payload: CategoryQueryForChildCategories | CategoryQueryForTopCategories,
  ): Promise<MagentoCategorySearchResult> {
    const groups: MagentoFilterGroup[] = [
      [{ field: 'parent_id', value: parentId, conditionType: 'eq' }],
      [{ field: 'is_active', value: '1', conditionType: 'eq' }],
    ];
    return this.catalog.listCategories(groups, {
      pageSize: payload.paginationOptions.pageSize,
      currentPage: payload.paginationOptions.pageNumber,
      sortOrders: [{ field: 'position', direction: 'ASC' }],
    });
  }

  /**
   * Adds `parentKey` (the parent's category key) to each category; null for
   * children of the store root and for parents Magento no longer knows.
   */
  protected async resolveParentKeys(categories: MagentoCategory[]): Promise<MagentoResolvedCategory[]> {
    const parentIds = categories
      .map((category) => String(category.parent_id))
      .filter((id) => !this.isRootOrAbove(id));
    const keys = parentIds.length > 0 ? await this.catalog.resolveCategoryKeys(parentIds) : {};
    return categories.map((category) => {
      const parentId = String(category.parent_id);
      return {
        ...category,
        parentKey: this.isRootOrAbove(parentId) ? null : keys[parentId] ?? null,
      };
    });
  }

  protected isRootOrAbove(categoryId: string): boolean {
    return categoryId === this.config.rootCategoryId || categoryId === '0' || categoryId === '1';
  }

  protected async cacheCategoryKeyToIdMapping(key: string, id: string) {
    await this.catalog.storeCategoryMapping(key, id);
  }

  /** @deprecated use `this.catalog.resolveCategoryIds`. The client argument is unused. */
  protected async translateCategoryKeyToMagentoId(_client: Magento, key: string): Promise<string | null> {
    return (await this.catalog.resolveCategoryIds([key]))[key] ?? null;
  }

  /** @deprecated use `this.catalog.resolveCategoryKeys`. */
  protected async translateMagentoIdToCategoryKey(magentoId: string): Promise<string | null> {
    return (await this.catalog.resolveCategoryKeys([magentoId]))[magentoId] ?? null;
  }

  /** @deprecated use `resolveParentKeys`; the category is no longer mutated. */
  protected async cleanupParentPointersForCategory(category: MagentoCategory): Promise<MagentoResolvedCategory> {
    const [resolved] = await this.resolveParentKeys([category]);
    return resolved;
  }

  /** @deprecated use `resolveParentKeys`. */
  protected async cleanupParentPointersForPaginatedResult(
    paginatedResult: MagentoCategorySearchResult,
  ): Promise<MagentoCategorySearchResult & { items: MagentoResolvedCategory[] }> {
    return { ...paginatedResult, items: await this.resolveParentKeys(paginatedResult.items) };
  }
}
