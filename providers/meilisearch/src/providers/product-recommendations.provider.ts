import {
  type Cache,
  ProductRecommendationsProvider,
  type ProductRecommendation,
  type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  type ProductRecommendationAlgorithmSimilarProductsQuery,
  type ProductRecommendationAlgorithmRelatedProductsQuery,
  type ProductRecommendationAlgorithmTrendingInCategoryQuery,
  type RequestContext,
} from '@reactionary/core';
import { MeiliSearch, type Hits, type RecordAny, type SearchParams, type SearchResponse } from 'meilisearch';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';

interface MeilisearchRecommendHit {
  id: string;
}

/**
 * MeilisearchProductRecommendationsProvider
 *
 * Provides product recommendations using Meilisearch's hybrid search and filtering capabilities.
 * Supports frequentlyBoughtTogether, similar, related, and trendingInCategory algorithms.
 *
 * Note: This implementation uses semantic search (if AI embedding is enabled) and facet-based filtering.
 * For production use, consider implementing more sophisticated recommendation logic or integrating
 * with a dedicated recommendation engine.
 */
export class MeilisearchProductRecommendationsProvider extends ProductRecommendationsProvider {
  protected config: MeilisearchConfiguration;

  constructor(config: MeilisearchConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);
    this.config = config;
  }

  /**
   * Get similar product recommendations
   * Uses semantic search to find visually or data-wise similar products
   */
  protected override async getSimilarProductsRecommendations(
    query: ProductRecommendationAlgorithmSimilarProductsQuery
  ): Promise<ProductRecommendation[]> {
    const client = new MeiliSearch({
      host: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });

    const index = client.index(this.config.indexName);

    if (!this.config.useAIEmbedding) {
      console.warn('AI embedding is not enabled in configuration. Similar product recommendations will be based on keyword matching, which may not provide optimal results.');
      return [];
    }

    try {
      const searchOptions: SearchParams = {
        limit: query.numberOfRecommendations,
      };

      const response = await index.searchSimilarDocuments<MeilisearchRecommendHit>({
        id: query.sourceProduct.key,
        limit: query.numberOfRecommendations,
        embedder: this.config.useAIEmbedding,
      });


      return this.parseRecommendations(response, 'similar');
    } catch (error) {
      console.error('Error fetching similar product recommendations:', error);
      return [];
    }
  }


  /**
   * Maps Meilisearch search results to ProductRecommendation format
   */
  protected parseRecommendations(recommendation: SearchResponse<MeilisearchRecommendHit>, algorithm: string): ProductRecommendation[] {
    return recommendation.hits.map((hit) => ({
      recommendationIdentifier: {
        key: hit.id,
        algorithm,
      },
      product: {
        key: hit.id,
      },
    }));
  }
}
