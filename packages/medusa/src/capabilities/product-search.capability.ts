import type {
  StoreProductCategory
} from '@medusajs/types';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  type Cache,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type RequestContext,
  type Result
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:search');

export class MedusaProductSearchCapability<
  TFactory extends ProductSearchFactory = MedusaProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async resolveCategoryIdByExternalId(
    externalId: string
  ): Promise<StoreProductCategory | null> {
    const sdk = await this.medusaApi.getClient();
    let offset = 0;
    const limit = 50;
    let candidate: StoreProductCategory | undefined = undefined;
    while (true) {
      try {
        const categoryResult = await sdk.store.category.list({
          offset,
          limit,
        });

        if (categoryResult.product_categories.length === 0) {
          break;
        }

        candidate = categoryResult.product_categories.find(
          (cat) => cat.metadata?.['external_id'] === externalId
        );
        if (candidate) {
          break;
        }
        offset += limit;
      } catch (error) {
        throw new Error(
          'Category not found ' + externalId + ' due to error: ' + error
        );
        break;
      }
    }
    return candidate || null;
  }


  protected queryByTermPayload(payload: ProductSearchQueryByTerm, categoryIdToFind: string | null): any {

    const finalSearch = (payload.search.term || '').trim().replace('*', '');

    return {
      q: finalSearch,
      ...(categoryIdToFind ? { category_id: categoryIdToFind } : {}),
      limit: payload.search.paginationOptions.pageSize,
      fields: '+metadata.*,+external_id',
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,
    }
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    });

    return success(facetValueIdentifier);
  }


  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();

    let categoryIdToFind: string | null = null;
    if (payload.search.categoryFilter?.key) {
      debug(
        `Resolving category filter for key: ${payload.search.categoryFilter.key}`
      );

      const category = await this.resolveCategoryIdByExternalId(
        payload.search.categoryFilter.key
      );
      if (category) {
        categoryIdToFind = category.id;
        debug(
          `Resolved category filter key ${payload.search.categoryFilter.key} to id: ${categoryIdToFind}`
        );
      } else {
        debug(
          `Could not resolve category filter for key: ${payload.search.categoryFilter.key}`
        );
      }
    }


    const response = await client.store.product.list(this.queryByTermPayload(payload, categoryIdToFind));

    const result = this.factory.parseSearchResult(this.context, response, payload);
    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.products.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

}
