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
import type { MagentoCategoryFactory } from '../factories/category/category.factory.js';
import createDebug from 'debug';
import type { MagentoCategory, MagentoCategorySearchResult, MagentoCustomAttribute } from '../schema/magento.types.js';

const debug = createDebug('reactionary:magento:category');

export class MagentoCategoryCapability<
  TFactory extends CategoryFactory = MagentoCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryFactoryPaginatedOutput<TFactory>
> {
  protected config: MagentoConfiguration;
  protected factory: CategoryFactoryWithOutput<TFactory>;

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
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const client = await this.magentoApi.getClient();
    try {
      const response = await client.store.category.getByExternalId(payload.id.key);
      if (!response) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }
      const cleanedResponse = await this.cleanupParentPointersForCategory(response);
      return success(await this.factory.parseCategory(this.context, cleanedResponse));
    } catch (e) {
      debug('Error getting category by id', e);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const client = await this.magentoApi.getClient();
    const params = new URLSearchParams();
    params.set('searchCriteria[filterGroups][0][filters][0][field]', 'url_key');
    params.set('searchCriteria[filterGroups][0][filters][0][value]', payload.slug);
    params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
    params.set('searchCriteria[pageSize]', '1');

    try {
      const response = await client.store.category.list(params);
      if (!response.items || response.items.length === 0) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }
      return success(
        await this.factory.parseCategory(this.context, await this.cleanupParentPointersForCategory(response.items[0]))
      );
    } catch (e) {
      debug('Error getting category by slug', e);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }



  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>[]>> {
    const client = await this.magentoApi.getClient();
    try {



      const category = await client.store.category.getByExternalId(payload.id.key);
      if (!category) {
        return error({
          type: 'NotFound',
          identifier: payload.id,
        });
      }

      let pathIds: string[] = (category.path || '').split('/').filter(Boolean);
      //remove all entries that above the root of the store. We ass-u-me you cant reparent categories, and we therefore can
      // ass-u-me that any id smaller than our configured root, are above us in the hierachy..
      pathIds = pathIds.filter(x => Number(x) > Number(this.config.rootCategoryId));

      if (pathIds.length === 0) {
        return success([ await this.factory.parseCategory(this.context, await this.cleanupParentPointersForCategory(category)) ]);
      }

      const params = new URLSearchParams();
      params.set('searchCriteria[filterGroups][0][filters][0][field]', 'entity_id');
      params.set('searchCriteria[filterGroups][0][filters][0][value]', pathIds.join(','));
      params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'in');

      const response = await client.store.category.list(params);
      const items = response.items || [];

      const results: CategoryFactoryCategoryOutput<TFactory>[] = [];
      for (const id of pathIds) {
        const found = items.find((c: MagentoCategory) => c.id === Number(id));
        if (found) {
          results.push(await this.factory.parseCategory(this.context, await this.cleanupParentPointersForCategory(found)));
        }
      }

      return success(results);
    } catch (e) {
      debug('Error getting breadcrumb path', e);
      throw new Error('Category not found or error fetching path: ' + payload.id.key);
    }
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {

    // since the key is the external_id which is not the actual category id in magento, we need to first fetch the category to get the real id, then fetch the children based on that id
    // this is not ideal, but unfortunately magento does not support filtering by custom attributes in the way we would need to do it in a single query
    const client = await this.magentoApi.getClient();

    const parentId = await this.translateCategoryKeyToMagentoId(client, payload.parentId.key);
    if (!parentId) {
      return error({
        type: 'NotFound',
        identifier: payload.parentId,
      });
    }

    const pageSize = payload.paginationOptions.pageSize;
    const currentPage = payload.paginationOptions.pageNumber;

    const params = new URLSearchParams();
    params.set('searchCriteria[filterGroups][0][filters][0][field]', 'parent_id');
    params.set('searchCriteria[filterGroups][0][filters][0][value]', parentId);
    params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');

    params.set('searchCriteria[filterGroups][1][filters][0][field]', 'is_active');
    params.set('searchCriteria[filterGroups][1][filters][0][value]', '1');
    params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');


    params.set('searchCriteria[pageSize]', String(pageSize));
    params.set('searchCriteria[currentPage]', String(currentPage));

    const response = await this.cleanupParentPointersForPaginatedResult(await client.store.category.list(params));
    return success(
        this.factory.parseCategoryPaginatedResult(this.context, {
        ...response,
        pageSize,
        currentPage,
      }),
    );
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    const client = await this.magentoApi.getClient();
    const pageSize = payload.paginationOptions.pageSize;
    const currentPage = payload.paginationOptions.pageNumber;

    const params = new URLSearchParams();
    params.set('searchCriteria[filterGroups][0][filters][0][field]', 'parent_id');
    params.set('searchCriteria[filterGroups][0][filters][0][value]', this.config.rootCategoryId);
    params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');

    params.set('searchCriteria[filterGroups][1][filters][0][field]', 'is_active');
    params.set('searchCriteria[filterGroups][1][filters][0][value]', '1');
    params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');

    params.set('searchCriteria[pageSize]', String(pageSize));
    params.set('searchCriteria[currentPage]', String(currentPage));

    const response = await this.cleanupParentPointersForPaginatedResult(await client.store.category.list(params));
    return success(
      this.factory.parseCategoryPaginatedResult(this.context, {
        ...response,
        pageSize,
        currentPage,
      })
    );
  }

  protected async cacheCategoryKeyToIdMapping(key: string, id: string) {
    await this.cache.put(`category_key_to_id:${key}`, id, {
      ttlSeconds: 60 * 60, // cache for 1 hour
      dependencyIds: [`category_key:${key}`],
    });

    await this.cache.put(`category_id_to_key:${id}`, key, {
      ttlSeconds: 60 * 60, // cache for 1 hour
      dependencyIds: [`category_id:${id}`],
    });
  }

  protected async translateCategoryKeyToMagentoId(client: Magento, key: string): Promise<string | null> {
    // since the key is the external_id which is not the actual category id in magento, we need to first fetch the category to get the real id
    // this is not ideal, but unfortunately magento does not support filtering by custom attributes in the way we would need to do it in a single query
    const cachedValue = await this.cache.get(`category_key_to_id:${key}`, z.string());
    if (cachedValue) {
      return cachedValue;
    }

    const response = await client.store.category.getByExternalId(key);

    if (!response) {
      return null;
    }

    const magentoId = String(response.id);
    await this.cacheCategoryKeyToIdMapping(key, magentoId);
    return magentoId;
  }

  protected async translateMagentoIdToCategoryKey(magentoId: string): Promise<string | null> {
    const categoryCacheKey = await this.cache.get(`category_id_to_key:${magentoId}`, z.string());
    if (categoryCacheKey) {
      return categoryCacheKey;
    }

    const client = await this.magentoApi.getClient();
    const response = await client.store.category.getById(magentoId);
    const keyAttr = response.custom_attributes?.find((a: MagentoCustomAttribute) => a.attribute_code === 'external_id');

    const key = String(keyAttr?.value || '-');
    await this.cacheCategoryKeyToIdMapping(key, magentoId);
    return key;
  }


  protected async cleanupParentPointersForCategory(category: MagentoCategory) {
      if (String(category.parent_id) === this.config.rootCategoryId) {
        category.parent_id = 0;
      } else {
        const parentKey = await this.translateMagentoIdToCategoryKey(String(category.parent_id));
        if (parentKey) {
          category.parent_id = Number(parentKey);
        }
      }
      return category;
  }

  protected async cleanupParentPointersForPaginatedResult(paginatedResult: MagentoCategorySearchResult) {
    for(const category of paginatedResult.items) {
      await this.cleanupParentPointersForCategory(category);
    }
    return paginatedResult;
  }
}
