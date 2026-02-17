import {
  type Cache,
  ProductRecommendationsProvider,
  type ProductRecommendation,
  type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  type ProductRecommendationAlgorithmSimilarProductsQuery,
  type ProductRecommendationAlgorithmRelatedProductsQuery,
  type ProductRecommendationAlgorithmTrendingInCategoryQuery,
  type RequestContext,
  type ProductRecommendationsQuery,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  ProductSearchResultItemVariantSchema,
  ImageSchema,
} from '@reactionary/core';
import {
  liteClient,
  type BoughtTogetherQuery,
  type LookingSimilarQuery,
  type RecommendationsResults,
  type RecommendSearchParams,
  type RelatedQuery,
  type TrendingItemsQuery,
  type LiteClient
} from 'algoliasearch/lite';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaProductRecommendationIdentifier } from '../schema/product-recommendation.schema.js';
import type { AlgoliaNativeRecord, AlgoliaNativeVariant } from '../schema/search.schema.js';


/**
 * AlgoliaProductRecommendationsProvider
 *
 * Provides product recommendations using Algolia's Recommend API.
 * Supports frequentlyBoughtTogether, similar, related, and trendingInCategory algorithms.
 *
 * Note: This requires Algolia Recommend to be enabled and AI models to be trained.
 * See: https://www.algolia.com/doc/guides/algolia-recommend/overview/
 */




export class AlgoliaProductRecommendationsProvider extends ProductRecommendationsProvider {
  protected config: AlgoliaConfiguration;
  protected client: LiteClient;

  constructor(config: AlgoliaConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);
    this.config = config;
    this.client = liteClient(this.config.appId, this.config.apiKey);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getRecommendationThreshold(_algorithm: string): number {
    // Default threshold can be customized per algorithm if needed
    // The parameter is currently unused but kept for future algorithm-specific threshold customization
    return 10;
  }

  protected getQueryParametersForRecommendations(algorithm: string): RecommendSearchParams {
    return  {
      userToken: this.context.session.identityContext?.personalizationKey || 'anonymous',
      analytics: true,
      analyticsTags: ['reactionary', algorithm],
      clickAnalytics: true
    } satisfies RecommendSearchParams;
  }

  /**
   * Get frequently bought together recommendations using Algolia Recommend
   */
  protected override async getFrequentlyBoughtTogetherRecommendations(
    query: ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery
  ): Promise<ProductRecommendation[]> {

    try {
      // Note: Algolia's Recommend API requires setting up AI Recommend models
      // This implementation uses the getRecommendations method from the recommend client
      const response = await this.client.getRecommendations({
        requests: [
          {
            indexName: this.config.indexName,
            model: 'bought-together',
            objectID: query.sourceProduct.key,
            maxRecommendations: query.numberOfRecommendations,
            threshold: this.getRecommendationThreshold('bought-together'),
            queryParameters: this.getQueryParametersForRecommendations('bought-together')
          } satisfies BoughtTogetherQuery,
        ],

      });

      const result = [];
      if (response.results) {
        for(const res of response.results) {
          result.push(...this.parseRecommendation(res, query));
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching frequently bought together recommendations:', error);
      return [];
    }
  }

  /**
   * Get similar product recommendations using Algolia Recommend
   */
  protected override async getSimilarProductsRecommendations(
    query: ProductRecommendationAlgorithmSimilarProductsQuery
  ): Promise<ProductRecommendation[]> {

    try {
      const response = await this.client.getRecommendations({
        requests: [
          {
            indexName: this.config.indexName,
            model: 'looking-similar',
            objectID: query.sourceProduct.key,
            maxRecommendations: query.numberOfRecommendations,
            threshold: this.getRecommendationThreshold('looking-similar'),
            queryParameters: this.getQueryParametersForRecommendations('looking-similar')
          } satisfies LookingSimilarQuery
        ],
      });

      const result = [];
      if (response.results) {
        for(const res of response.results) {
          result.push(...this.parseRecommendation(res, query));
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching similar product recommendations:', error);
      return [];
    }
  }

  /**
   * Get related product recommendations using Algolia Recommend
   */
  protected override async getRelatedProductsRecommendations(
    query: ProductRecommendationAlgorithmRelatedProductsQuery
  ): Promise<ProductRecommendation[]> {

    try {
      const response = await this.client.getRecommendations({
        requests: [
          {
            indexName: this.config.indexName,
            model: 'related-products',
            objectID: query.sourceProduct.key,
            maxRecommendations: query.numberOfRecommendations,
            threshold: this.getRecommendationThreshold('related-products'),
            queryParameters: this.getQueryParametersForRecommendations('related-products')
          } satisfies RelatedQuery,
        ],
      });

      const result = [];
      if (response.results) {
        for(const res of response.results) {
          result.push(...this.parseRecommendation(res, query));
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching related product recommendations:', error);
      return [];
    }
  }

  /**
   * Get trending in category recommendations using Algolia Recommend
   */
  protected override async getTrendingInCategoryRecommendations(
    query: ProductRecommendationAlgorithmTrendingInCategoryQuery
  ): Promise<ProductRecommendation[]> {
    try {
      const response = await this.client.getRecommendations({
        requests: [
          {
            indexName: this.config.indexName,
            model: 'trending-items',
            facetName: 'categories',
            facetValue: query.sourceCategory.key,
            maxRecommendations: query.numberOfRecommendations,
            threshold: this.getRecommendationThreshold('trending-items'),
            queryParameters: this.getQueryParametersForRecommendations('trending-items')
          } satisfies TrendingItemsQuery,
        ],
      });

      const result = [];
      if (response.results) {
        for(const res of response.results) {
          result.push(...this.parseRecommendation(res, query));
        }
      }
      return result;
    } catch (error) {
      console.error('Error fetching trending in category recommendations:', error);
      return [];
    }
  }


  protected parseRecommendation(res: RecommendationsResults, query: ProductRecommendationsQuery) {
    const result = [];
    for(const hit of res.hits as AlgoliaNativeRecord[]) {
      const recommendationIdentifier = {
        key: res.queryID || 'x',
        algorithm: query.algorithm,
        abTestID: res.abTestID,
        abTestVariantID: res.abTestVariantID
      } satisfies AlgoliaProductRecommendationIdentifier
      const recommendation = this.parseSingle(hit, recommendationIdentifier)
      result.push(recommendation);
    }
    return result;
  }

  /**
   * Maps Algolia recommendation results to ProductRecommendation format
   */
  protected parseSingle(hit: AlgoliaNativeRecord, recommendationIdentifier: AlgoliaProductRecommendationIdentifier): ProductRecommendation {

    const product = this.parseSearchResultItem(hit);

    return {
      recommendationIdentifier,
      recommendationReturnType: 'productSearchResultItem',
      product: product,
    } satisfies ProductRecommendation;
  }


    protected parseSearchResultItem(body: AlgoliaNativeRecord) {
      const product = {
        identifier: { key: body.objectID },
        name: body.name || body.objectID,
        slug: body.slug || body.objectID,
        variants: [ ... (body.variants || []) ].map(variant => this.parseVariant(variant, body)),
      } satisfies ProductSearchResultItem;

      return product;
    }

    protected parseVariant(variant: AlgoliaNativeVariant, product: AlgoliaNativeRecord): ProductSearchResultItemVariant {
        const result = ProductSearchResultItemVariantSchema.parse({
        variant: {
          sku: variant.sku
        },
        image: ImageSchema.parse({
          sourceUrl: variant.image,
          altText: product.name || '',
        })
      } satisfies Partial<ProductSearchResultItemVariant>);

      return result;
    }
}
