import {
  ProductRecommendationsCapability,
  ProductRecommendationsQuerySchema,
  ProductRecommendationsByCollectionQuerySchema,
  Reactionary,
  type Cache,
  type ProductRecommendation,
  type ProductRecommendationAlgorithmAlsoViewedProductsQuery,
  type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  type ProductRecommendationAlgorithmPopuplarProductsQuery,
  type ProductRecommendationAlgorithmRelatedProductsQuery,
  type ProductRecommendationAlgorithmSimilarProductsQuery,
  type ProductRecommendationAlgorithmTopPicksProductsQuery,
  type ProductRecommendationAlgorithmTrendingInCategoryQuery,
  type ProductRecommendationsByCollectionQuery,
  type ProductRecommendationsFactory,
  type ProductRecommendationsFactoryWithOutput,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclEspotResponse } from '../schema/hcl.schema.js';
import type { HclProductRecommendationsFactory } from '../factories/product-recommendations/product-recommendations.factory.js';

export class HclProductRecommendationsCapability<
  TFactory extends
    ProductRecommendationsFactory = HclProductRecommendationsFactory,
> extends ProductRecommendationsCapability {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductRecommendationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductRecommendationsQuerySchema,
  })
  public override getRecommendations(
    ...args: Parameters<ProductRecommendationsCapability['getRecommendations']>
  ) {
    return super.getRecommendations(...args);
  }

  @Reactionary({
    inputSchema: ProductRecommendationsByCollectionQuerySchema,
  })
  public override async getCollection(
    query: ProductRecommendationsByCollectionQuery,
  ): Promise<Result<ProductRecommendation[]>> {
    const params: Record<string, string | undefined> = {
      productId: query.sourceProduct?.[0]?.key,
      categoryId: query.sourceCategory?.key,
      count: String(query.numberOfRecommendations),
    };
    const recommendations = await this.fetchEspot(
      query.collectionName,
      query.collectionName,
      params,
    );
    return success(recommendations.slice(0, query.numberOfRecommendations));
  }

  protected override async getFrequentlyBoughtTogetherRecommendations(
    query: ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(
      this.config.espotNames.frequentlyBoughtTogether,
      'frequentlyBoughtTogether',
      {
        productId: query.sourceProduct.key,
        count: String(query.numberOfRecommendations),
      },
    );
  }

  protected override async getSimilarProductsRecommendations(
    query: ProductRecommendationAlgorithmSimilarProductsQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(this.config.espotNames.similar, 'similar', {
      productId: query.sourceProduct.key,
      count: String(query.numberOfRecommendations),
    });
  }

  protected override async getRelatedProductsRecommendations(
    query: ProductRecommendationAlgorithmRelatedProductsQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(this.config.espotNames.related, 'related', {
      productId: query.sourceProduct.key,
      count: String(query.numberOfRecommendations),
    });
  }

  protected override async getTrendingInCategoryRecommendations(
    query: ProductRecommendationAlgorithmTrendingInCategoryQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(
      this.config.espotNames.trendingInCategory,
      'trendingInCategory',
      {
        categoryId: query.sourceCategory.key,
        count: String(query.numberOfRecommendations),
      },
    );
  }

  protected override async getPopularProductsRecommendations(
    query: ProductRecommendationAlgorithmPopuplarProductsQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(this.config.espotNames.popular, 'popular', {
      count: String(query.numberOfRecommendations),
    });
  }

  protected override async getTopPicksProductsRecommendations(
    query: ProductRecommendationAlgorithmTopPicksProductsQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(this.config.espotNames.topPicks, 'topPicks', {
      count: String(query.numberOfRecommendations),
    });
  }

  protected override async getAlsoViewedProductsRecommendations(
    query: ProductRecommendationAlgorithmAlsoViewedProductsQuery,
  ): Promise<ProductRecommendation[]> {
    return this.fetchEspot(this.config.espotNames.alsoViewed, 'alsoViewed', {
      productId: query.sourceProduct.key,
      count: String(query.numberOfRecommendations),
    });
  }

  /**
   * Calls an HCL marketing spot (espot) by name and maps its catalog entry
   * activity data to `ProductRecommendation[]` using the factory.
   *
   * Returns an empty array when the espot is not found (404) or returns no
   * catalog entry data — allowing teams to configure only the espots they need.
   */
  protected async fetchEspot(
    name: string,
    algorithm: string,
    params: Record<string, string | undefined> = {},
  ): Promise<ProductRecommendation[]> {
    const response = await this.client.callGet<HclEspotResponse>(
      this.getEspotUrl(name),
      this.getEspotParams(params),
      { allowUndefined: true },
    );

    if (!response) {
      return [];
    }

    const activities =
      response.MarketingSpotData?.[0]?.baseMarketingSpotActivityData ?? [];

    return activities
      .filter(
        (a) =>
          a.baseMarketingSpotDataType === 'CatalogEntry' ||
          a.baseMarketingSpotDataType === 'CatalogEntryId',
      )
      .map((a) =>
        this.factory.parseRecommendation(this.context, {
          activityData: a,
          algorithm,
        }),
      )
      .filter((r) => r.product.key !== '');
  }

  protected getEspotUrl(name: string): string {
    return `${this.client.transactionBaseUrl}/espot/${encodeURIComponent(name)}`;
  }

  protected getEspotParams(
    params: Record<string, string | undefined>,
  ): URLSearchParams {
    const searchParams = new URLSearchParams();
    const count = params['count'];
    if (count) searchParams.set('DM_DisplayProducts', count);
    if (params['productId']) searchParams.set('productId', params['productId']);
    if (params['categoryId'])
      searchParams.set('categoryId', params['categoryId']);
    return searchParams;
  }
}
