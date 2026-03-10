import {
  CategoryPaginatedResultSchema,
  type CategoryFactory,
  type CategoryFactoryCategoryOutput,
  type CategoryFactoryWithOutput,
  CategoryCapability,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import type {
  CategoryQueryById,
  CategoryQueryBySlug,
  CategoryQueryForBreadcrumb,
  CategoryQueryForChildCategories,
  CategoryQueryForTopCategories,
  RequestContext,
  Cache,
  CategoryPaginatedResult,
  Result,
  NotFoundError,
} from '@reactionary/core';
import * as z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  ByProjectKeyCategoriesRequestBuilder,
} from '@commercetools/platform-sdk';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsCategoryFactory } from '../factories/category/category.factory.js';

export class CommercetoolsCategoryCapability<
  TFactory extends CategoryFactory = CommercetoolsCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryPaginatedResult
> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: CategoryFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: CategoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient(): Promise<ByProjectKeyCategoriesRequestBuilder> {
    const client = await this.commercetools.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .categories();
  }

  /**
   * Look it up by the category ID (key in commercetools), and if not there, return a placeholder.
   */
  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();
    try {
      const response = await client
        .withKey({ key: payload.id.key })
        .get()
        .execute();
      return success(this.factory.parseCategory(this.context, response.body));
    } catch (err) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.id,
      });
    }
  }

  /**
   * Resolve the category by slug, in the users current locale.
   */
  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema,
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();
    try {
      const response = await client
        .get({
          queryArgs: {
            where: `slug(${this.context.languageContext.locale}=:slug)`,
            'var.slug': payload.slug,
            storeProjection: this.context.storeIdentifier.key,
            limit: 1,
            withTotal: false,
          },
        })
        .execute();
      if (response.body.results.length === 0) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.slug,
        });
      }
      return success(this.factory.parseCategory(this.context, response.body.results[0]));
    } catch (err) {
      console.error(`Error fetching category by slug:`, error);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }
  }

  /**
   * Returns the breadcrumb path to the category, i.e. all parents up to the root.
   * The returned order is from root to leaf.
   */
  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb
  ): Promise<Result<Array<CategoryFactoryCategoryOutput<TFactory>>>> {
    const client = await this.getClient();
    const path: Array<CategoryFactoryCategoryOutput<TFactory>> = [];
    try {
      const response = await client
        .withKey({ key: payload.id.key })
        .get({
          queryArgs: {
            expand: 'ancestors[*]',
          },
        })
        .execute();

      const category = this.factory.parseCategory(this.context, response.body);
      for (const anc of response.body.ancestors || []) {
        if (anc.obj) {
          const parsedAnc = this.factory.parseCategory(this.context, anc.obj);
          path.push(parsedAnc);
        }
      }
      path.push(category);
    } catch (error) {
      console.error(
        `Error fetching category path for  ${payload.id.key}:`,
        error
      );
    }
    return success(path);
  }

  /**
   * Returns a page of child categories for the given parent category ID.
   * You must provide the pagination options to control the size of the result set.
   * If you expect your frontend will load many many categories, consider adding a "load more" button, or lazy load the next page.
   *
   * This is cached by ID + page number + page size + locale + store
   */
  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories
  ) {
    // ok, so for Commercetools we can't actually query by the parents key, so we have to first resolve the key to an ID, then query by that.
    // This is a bit of a pain, but we can cache the result of the first lookup for a short period to mitigate it.

    const client = await this.getClient();

    try {
      const parentCategory = await client
        .withKey({ key: payload.parentId.key })
        .get()
        .execute();

      // it is true, we could just do a withKey and get the children directly, but that would not be paginated.
      // So we do it the hard way, and query by parent ID instead.
      // This also means we can sort the results, which is nice.

      const response = await client
        .get({
          queryArgs: {
            where: 'parent(id = :parentId)',
            'var.parentId': parentCategory.body.id,
            limit: payload.paginationOptions.pageSize,
            offset:
              (payload.paginationOptions.pageNumber - 1) *
              payload.paginationOptions.pageSize,
            sort: 'orderHint asc',
            storeProjection: this.context.storeIdentifier.key,
          },
        })
        .execute();

      const result = this.factory.parseCategoryPaginatedResult(this.context, response.body);
      return success(result);
    } catch (error) {
      console.error(
        `Error fetching category path for  ${payload.parentId.key}:`,
        error
      );
    }

    const empty = {
      items: [],
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalCount: 0,
      totalPages: 0,
    } satisfies CategoryPaginatedResult;

    return success(empty);
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    payload: CategoryQueryForTopCategories
  ) {
    const client = await this.getClient();
    try {
      const response = await client
        .get({
          queryArgs: {
            where: 'parent is not defined',
            limit: payload.paginationOptions.pageSize,
            offset:
              (payload.paginationOptions.pageNumber - 1) *
              payload.paginationOptions.pageSize,
            sort: 'orderHint asc',
            storeProjection: this.context.storeIdentifier.key,
          },
        })
        .execute();

      const result = this.factory.parseCategoryPaginatedResult(this.context, response.body);
      return success(result);
    } catch (error) {
      console.error(`Error fetching category top categories:`, error);
    }

    const empty = {
      items: [],
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalCount: 0,
      totalPages: 0,
    } satisfies CategoryPaginatedResult;

    return success(empty);
  }

  /**
   * Handler for parsing a response from a remote capability implementation and converting it
   * into the typed domain model.
   */
}
