import type { Cache } from '../cache/cache.interface.js';
import { Reactionary } from "../decorators/reactionary.decorator.js";
import { success, type ProductRecommendation, type ProductRecommendationsByCollectionQuery, type RequestContext, type Result } from "../schemas/index.js";
import { ProductRecommendationsQuerySchema, type ProductRecommendationAlgorithmAlsoViewedProductsQuery, type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery, type ProductRecommendationAlgorithmPopuplarProductsQuery, type ProductRecommendationAlgorithmRelatedProductsQuery, type ProductRecommendationAlgorithmSimilarProductsQuery, type ProductRecommendationAlgorithmTopPicksProductsQuery, type ProductRecommendationAlgorithmTrendingInCategoryQuery, type ProductRecommendationsQuery } from "../schemas/queries/product-recommendations.query.js";
import { BaseCapability } from "./base.capability.js";

export abstract class ProductRecommendationsCapability extends BaseCapability {

  /**
   * returns a list of recommended products, based on the selected algorithm and the provided query parameters. The recommendations should be relevant to the product specified in the query, and can be personalized based on the customer segments or contexts provided. The capability should return a list of product variant identifiers that are recommended for the given product, which can then be used to fetch the full product details from the product capability if needed.
   *   *
   * Usecase:
   *   - PDP - "Customers who viewed this product also viewed"
   *   - Cart - "You might also like"
   *   - Post-purchase - "Customers who bought this product also bought"
   *   - Article page: "Products related to the product mentioned in this article"
   * @param query
   */
  public async getRecommendations(query: ProductRecommendationsQuery): Promise<Result<ProductRecommendation[]>> {
    if (query.algorithm === 'frequentlyBoughtTogether') {
      return success(await this.getFrequentlyBoughtTogetherRecommendations(query));
    }

    if (query.algorithm === 'similar') {
      return success(await this.getSimilarProductsRecommendations(query));
    }

    if (query.algorithm === 'related') {
      return success(await this.getRelatedProductsRecommendations(query));
    }

    if (query.algorithm === 'trendingInCategory') {
      return success(await this.getTrendingInCategoryRecommendations(query));
    }

    if (query.algorithm === 'popular') {
      return success(await this.getPopularProductsRecommendations(query));
    }

    if (query.algorithm === 'topPicks') {
      return success(await this.getTopPicksProductsRecommendations(query));
    }

    if (query.algorithm === 'alsoViewed') {
      return success(await this.getAlsoViewedProductsRecommendations(query));
    }
    return success([]);
  }

  public async getCollection(query: ProductRecommendationsByCollectionQuery): Promise<Result<ProductRecommendation[]>> {
    return success([]);
  }

  protected async getFrequentlyBoughtTogetherRecommendations(query: ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery): Promise<ProductRecommendation[]> {
     return [];
  }

  protected async getSimilarProductsRecommendations(query: ProductRecommendationAlgorithmSimilarProductsQuery): Promise<ProductRecommendation[]> {
    return [];
  }

  protected async getTrendingInCategoryRecommendations(query: ProductRecommendationAlgorithmTrendingInCategoryQuery): Promise<ProductRecommendation[]> {
    return [];
  }

  protected async getRelatedProductsRecommendations(query: ProductRecommendationAlgorithmRelatedProductsQuery): Promise<ProductRecommendation[]> {
    return [];
  }

  protected async getPopularProductsRecommendations(query: ProductRecommendationAlgorithmPopuplarProductsQuery): Promise<ProductRecommendation[]> {
    return [];
  }

  protected async getTopPicksProductsRecommendations(query: ProductRecommendationAlgorithmTopPicksProductsQuery): Promise<ProductRecommendation[]> {
    return [];
  }

  protected async getAlsoViewedProductsRecommendations(query: ProductRecommendationAlgorithmAlsoViewedProductsQuery): Promise<ProductRecommendation[]> {
    return [];
  }


  protected override getResourceName(): string {
    return 'product-recommendations';
  }


}



export class MulticastProductRecommendationsCapability extends ProductRecommendationsCapability {
  protected capabilities: Array<ProductRecommendationsCapability>;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    capabilities: Array<ProductRecommendationsCapability>
  ) {
    super(cache, requestContext);

    this.capabilities = capabilities;
  }

  @Reactionary({
    inputSchema: ProductRecommendationsQuerySchema,
  })
  public override  async getRecommendations(query: ProductRecommendationsQuery): Promise<Result<ProductRecommendation[]>> {
    const output = [];
    for (const capability of this.capabilities) {
      const capabilityOutput = await capability.getRecommendations(query);
      if (capabilityOutput.success) {

        output.push(...capabilityOutput.value);
      } else {
        // For other types of errors, we might want to log them or handle them differently
        console.error(`Error from capability ${capability.constructor.name}:`, capabilityOutput.error);
        return capabilityOutput
      }
      if (output.length >= query.numberOfRecommendations) {
        break;
      }
    }
    return success(output.slice(0, query.numberOfRecommendations));
  }

  public override async getCollection(query: ProductRecommendationsByCollectionQuery): Promise<Result<ProductRecommendation[]>> {
    const output = [];
    for (const capability of this.capabilities) {
      const capabilityOutput = await capability.getCollection(query);
      if (capabilityOutput.success) {
        output.push(...capabilityOutput.value);
      } else {
        if (capabilityOutput.error.type === 'NotFound') {
          // If the error is a NotFound error, we can ignore it and continue to the next capability
          continue;
        } else {
          // For other types of errors, we might want to log them or handle them differently
          console.error(`Error from capability ${capability.constructor.name}:`, capabilityOutput.error);
          return capabilityOutput;
        }
      }
      if (output.length >= query.numberOfRecommendations) {
        break;
      }
    }
    return success(output.slice(0, query.numberOfRecommendations));
  }

}
