import { CategoryProvider, Cache, Category, createPaginatedResponseSchema } from "@reactionary/core";
import type { Session, CategoryQueryById, CategoryQueryBySlug, CategoryQueryForBreadcrumb, CategoryQueryForChildCategories, CategoryQueryForTopCategories } from "@reactionary/core";
import z from "zod";
import { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsClient } from "../core/client";
import { ByProjectKeyCategoriesRequestBuilder, CategoryPagedQueryResponse, Category as CTCategory } from "@commercetools/platform-sdk";
import { traced } from "@reactionary/otel";

export class CommercetoolsCategoryProvider<
  T extends Category = Category,
> extends CategoryProvider<T> {

  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  protected getClient(session: Session): ByProjectKeyCategoriesRequestBuilder {
    const token = session.identity.keyring.find(x => x.service === 'commercetools')?.token;
    const client = new CommercetoolsClient(this.config).getClient(
      token
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).categories();
  }

  /**
   * Look it up by the category ID (key in commercetools), and if not there, return a placeholder.
   * @param id
   * @param session
   * @returns
   */
  @traced()
  public override async getById(payload: CategoryQueryById, session: Session): Promise<T> {
    const client = this.getClient(session);
    try {
      const response = await client.withKey({ key: payload.id.key }).get().execute();
      return this.parseSingle(response.body, session);
    } catch (error) {
      const dummyCategory = this.newModel();
      dummyCategory.meta.placeholder = true;
      dummyCategory.identifier = { key: payload.id.key };
      return dummyCategory;
    }
  }

  /**
   * Resolve the category by slug, in the users current locale.
   * @param slug
   * @param session
   * @returns
   */
  @traced()
  public override async getBySlug(payload: CategoryQueryBySlug, session: Session): Promise<T | null> {
    const client = this.getClient(session);
    try {
      const response = await client.get({
        queryArgs: {
          where: `slug(${session.languageContext.locale}=:slug)`,
          'var.slug': payload.slug,
          storeProjection: session.storeIdentifier.key ,
          limit: 1,
          withTotal: false,
        }
      }).execute();
      if (response.body.results.length === 0) {
        return null;
      }
      return this.parseSingle(response.body.results[0], session);
    } catch (error) {
      console.error(`Error fetching category by slug:`, error);
      return null;
    }
  }

  /**
   * Returns the breadcrumb path to the category, i.e. all parents up to the root.
   * The returned order is from root to leaf.
   * @param id
   * @param session
   * @returns
   */
  @traced()
  public override async getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb, session: Session): Promise<T[]> {
    const client = this.getClient(session);
    const path: T[] = [];
    try {
      const response = await client.withKey({ key: payload.id.key }).get({
        queryArgs: {
          expand: 'ancestors[*]'
        }
      }).execute();

      const category = this.parseSingle(response.body, session);
      for(const anc of response.body.ancestors || []) {
        if (anc.obj) {
          const parsedAnc = this.parseSingle(anc.obj, session);
          path.push(parsedAnc);
        }
      };
      path.push(category);
    } catch (error) {
      console.error(`Error fetching category path for  ${payload.id.key}:`, error);
    }
    return path;
  }


  /**
   * Returns a page of child categories for the given parent category ID.
   * You must provide the pagination options to control the size of the result set.
   * If you expect your frontend will load many many categories, consider adding a "load more" button, or lazy load the next page.
   *
   * This is cached by ID + page number + page size + locale + store
   * @param id
   * @param paginationOptions
   * @param session
   * @returns
   */
  @traced()
  public override async findChildCategories(payload: CategoryQueryForChildCategories, session: Session) {

    // ok, so for Commercetools we can't actually query by the parents key, so we have to first resolve the key to an ID, then query by that.
    // This is a bit of a pain, but we can cache the result of the first lookup for a short period to mitigate it.

    const client = this.getClient(session);

    try {
      const parentCategory = await client.withKey({ key: payload.parentId.key }).get().execute();

      // it is true, we could just do a withKey and get the children directly, but that would not be paginated.
      // So we do it the hard way, and query by parent ID instead.
      // This also means we can sort the results, which is nice.

      const response = await client.get({
          queryArgs: {
            where: 'parent(id = :parentId)',
            'var.parentId': parentCategory.body.id,
            limit: payload.paginationOptions.pageSize,
            offset: (payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize,
            sort: 'orderHint asc',
            storeProjection: session.storeIdentifier.key ,
          },
        })
        .execute();

      const result = this.parsePaginatedResult(response.body, session);
      result.meta = {
        cache: { hit: false, key: this.generateCacheKeyPaginatedResult('children-of-' + payload.parentId.key, result, session) },
        placeholder: false
      };
      return result;
    } catch (error) {
      console.error(`Error fetching category path for  ${payload.parentId.key}:`, error);
    }
    return createPaginatedResponseSchema(this.schema).parse({});
  }

  @traced()
  public override async findTopCategories(payload: CategoryQueryForTopCategories, session: Session) {

    const client = this.getClient(session);
    try {
      const response = await client.get({
          queryArgs: {
            where: 'parent is not defined',
            limit: payload.paginationOptions.pageSize,
            offset: (payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize,
            sort: 'orderHint asc',
            storeProjection: session.storeIdentifier.key ,
          },
        })
        .execute();

      const result = this.parsePaginatedResult(response.body, session);
      result.meta = {
        cache: { hit: false, key: this.generateCacheKeyPaginatedResult('top', result, session) },
        placeholder: false
      };
      return result;
    } catch (error) {
      console.error(`Error fetching category top categories:`, error);
    }
    return createPaginatedResponseSchema(this.schema).parse({});
  }




    /**
   * Handler for parsing a response from a remote provider and converting it
   * into the typed domain model.
   */
  @traced()
  protected override parseSingle(_body: unknown, session: Session): T {
    const body = _body as CTCategory;
    const languageContext = session.languageContext;

    const model = this.newModel();

    model.identifier = { key: body.key! };
    model.name = body.name[languageContext.locale] || 'No Name';
    model.slug = body.slug ? (body.slug[languageContext.locale] || '') : '';
    model.text = body.description ? (body.description[languageContext.locale] || '') : '';

    model.parentCategory = body.parent && body.parent.obj  && body.parent.obj?.key ? { key: body.parent.obj.key } : undefined;

    model.images = (body.assets || []).filter(asset => asset.sources.length > 0).filter(x => x.sources[0].contentType?.startsWith('image/')).map( (asset) => {
      return {
        sourceUrl: asset.sources[0].uri,
        altText: asset.description?.[languageContext.locale] || asset.name[languageContext.locale] || '',
        height: asset.sources[0].dimensions?.h || 0,
        width: asset.sources[0].dimensions?.w || 0,
      }
    });

    model.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(model.identifier, session) },
      placeholder: false
    };

    return this.assert(model);
  }


  @traced()
  protected override parsePaginatedResult(_body: unknown, session: Session) {
    const body = _body as  CategoryPagedQueryResponse;

    const items = body.results.map(x => this.parseSingle(x, session));

    const result = createPaginatedResponseSchema(this.schema).parse({
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false
      },
      pageNumber: Math.floor(body.offset / body.count) + 1,
      pageSize: body.count,
      totalCount: body.total || 0,
      totalPages: Math.ceil((body.total ?? 0) / body.count),
      items: items
    });
    return result;
  }
}
