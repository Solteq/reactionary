import {
  CategoryPaginatedResultSchema,
  CategoryProvider,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  Reactionary,
} from '@reactionary/core';
import type {
  CategoryQueryById,
  CategoryQueryBySlug,
  CategoryQueryForBreadcrumb,
  CategoryQueryForChildCategories,
  CategoryQueryForTopCategories,
  RequestContext,
  Cache,
  Category,
  CategoryPaginatedResult,
  CategoryIdentifier,
} from '@reactionary/core';
import z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  ByProjectKeyCategoriesRequestBuilder,
  CategoryPagedQueryResponse,
  Category as CTCategory,
} from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsCategoryProvider extends CategoryProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient(): Promise<ByProjectKeyCategoriesRequestBuilder> {
    const client = await this.client.getClient();
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
  public override async getById(payload: CategoryQueryById): Promise<Category> {
    const client = await this.getClient();
    try {
      const response = await client
        .withKey({ key: payload.id.key })
        .get()
        .execute();
      return this.parseSingle(response.body);
    } catch (error) {
      const dummyCategory = {
        identifier: {
          key: payload.id.key,
        },
        images: [],
        name: '',
        slug: '',
        text: '',
        meta: {
          cache: {
            hit: false,
            key: '',
          },
          placeholder: false,
        },
      } satisfies Category;

      return dummyCategory;
    }
  }

  /**
   * Resolve the category by slug, in the users current locale.
   */
  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema.nullable(),
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug
  ): Promise<Category | null> {
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
        return null;
      }
      return this.parseSingle(response.body.results[0]);
    } catch (error) {
      console.error(`Error fetching category by slug:`, error);
      return null;
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
  ): Promise<Category[]> {
    const client = await this.getClient();
    const path = new Array<Category>();
    try {
      const response = await client
        .withKey({ key: payload.id.key })
        .get({
          queryArgs: {
            expand: 'ancestors[*]',
          },
        })
        .execute();

      const category = this.parseSingle(response.body);
      for (const anc of response.body.ancestors || []) {
        if (anc.obj) {
          const parsedAnc = this.parseSingle(anc.obj);
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
    return path;
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

      const result = this.parsePaginatedResult(response.body);
      result.meta = {
        cache: {
          hit: false,
          key: this.generateCacheKeyPaginatedResult(
            'children-of-' + payload.parentId.key,
            result
          ),
        },
        placeholder: false,
      };
      return result;
    } catch (error) {
      console.error(
        `Error fetching category path for  ${payload.parentId.key}:`,
        error
      );
    }

    const empty = {
      items: [],
      meta: {
        cache: {
          hit: false,
          key: '',
        },
        placeholder: true,
      },
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalCount: 0,
      totalPages: 0,
    } satisfies CategoryPaginatedResult;

    return empty;
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

      const result = this.parsePaginatedResult(response.body);
      result.meta = {
        cache: {
          hit: false,
          key: this.generateCacheKeyPaginatedResult('top', result),
        },
        placeholder: false,
      };
      return result;
    } catch (error) {
      console.error(`Error fetching category top categories:`, error);
    }

    const empty = {
      items: [],
      meta: {
        cache: {
          hit: false,
          key: '',
        },
        placeholder: true,
      },
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalCount: 0,
      totalPages: 0,
    } satisfies CategoryPaginatedResult;

    return empty;
  }

  /**
   * Handler for parsing a response from a remote provider and converting it
   * into the typed domain model.
   */
  protected parseSingle(_body: unknown): Category {
    const body = _body as CTCategory;
    const languageContext = this.context.languageContext;

    const identifier = { key: body.key! } satisfies CategoryIdentifier;
    const model = {
      identifier,
      name: body.name[languageContext.locale] || 'No Name',
      slug: body.slug ? body.slug[languageContext.locale] || '' : '',
      text: body.description
        ? body.description[languageContext.locale] || ''
        : '',
      parentCategory: body.parent && body.parent.obj && body.parent.obj?.key
          ? { key: body.parent.obj.key }
          : undefined,
      images: (body.assets || [])
      .filter((asset) => asset.sources.length > 0)
      .filter((x) => x.sources[0].contentType?.startsWith('image/'))
      .map((asset) => {
        return {
          sourceUrl: asset.sources[0].uri,
          altText:
            asset.description?.[languageContext.locale] ||
            asset.name[languageContext.locale] ||
            '',
          height: asset.sources[0].dimensions?.h || 0,
          width: asset.sources[0].dimensions?.w || 0,
        };
      }),
      meta: {
        cache: { hit: false, key: this.generateCacheKeySingle(identifier) },
        placeholder: false,
      }
    } satisfies Category;

    return model;
  }

  protected parsePaginatedResult(_body: unknown) {
    const body = _body as CategoryPagedQueryResponse;
    const items = body.results.map((x) => this.parseSingle(x));
    const result = {
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false,
      },
      pageNumber: Math.floor(body.offset / body.count) + 1,
      pageSize: body.count,
      totalCount: body.total || 0,
      totalPages: Math.ceil((body.total ?? 0) / body.count),
      items: items,
    } satisfies CategoryPaginatedResult;

    return result;
  }
}
