import {
  ProductRecommendationsCapability,
  Reactionary,
  success,
  type Cache,
  type ProductIdentifier,
  type ProductRecommendation,
  type ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  type ProductRecommendationAlgorithmRelatedProductsQuery,
  type ProductRecommendationAlgorithmSimilarProductsQuery,
  type ProductRecommendationAlgorithmTrendingInCategoryQuery,
  type ProductRecommendationsByCollectionQuery,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoProduct,
  MagentoProductLinkType,
} from '../schema/magento.types.js';
import {
  fetchProductsBySkus,
  fetchProductsInCategory,
  findCategoryByName,
  resolveProductSku,
} from '../utils/magento-product-lookup.js';
import { buildProductSearchResultItem } from '../utils/magento-product.js';

const debug = createDebug('reactionary:magento:product-recommendations');

/**
 * Magento has no recommendation engine, so recommendations are derived from the
 * catalogue itself: native product links for the product based algorithms, and
 * the category tree for collections and category trends.
 */
export class MagentoProductRecommendationsCapability extends ProductRecommendationsCapability {
  protected config: MagentoConfiguration;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
  ) {
    super(cache, context);
    this.config = config;
  }

  protected getRelatedLinkType(): MagentoProductLinkType {
    return 'related';
  }

  protected getSimilarLinkType(): MagentoProductLinkType {
    return 'upsell';
  }

  protected getFrequentlyBoughtTogetherLinkType(): MagentoProductLinkType {
    return 'crosssell';
  }

  protected toRecommendations(
    algorithm: string,
    keyPrefix: string,
    products: MagentoProduct[],
  ): ProductRecommendation[] {
    return products.map(
      (product) =>
        ({
          recommendationIdentifier: {
            key: `${keyPrefix}_${product.sku}`,
            algorithm,
          },
          recommendationReturnType: 'productSearchResultItem',
          product: buildProductSearchResultItem(this.config, product),
        }) satisfies ProductRecommendation,
    );
  }

  protected async fetchLinkedProducts(
    sourceProduct: ProductIdentifier,
    linkType: MagentoProductLinkType,
    numberOfRecommendations: number,
  ): Promise<MagentoProduct[]> {
    const sku = await resolveProductSku(this.magentoApi, sourceProduct.key);
    if (!sku) {
      return [];
    }

    try {
      const links = await this.magentoApi.getProductLinks(sku, linkType);
      const linkedSkus = [...links]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((link) => link.linked_product_sku)
        .slice(0, numberOfRecommendations);

      return await fetchProductsBySkus(this.magentoApi, linkedSkus);
    } catch (err) {
      debug('Failed to load %s links for %s: %O', linkType, sku, err);
      return [];
    }
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getCollection(
    query: ProductRecommendationsByCollectionQuery,
  ): Promise<Result<ProductRecommendation[]>> {
    const category = await findCategoryByName(
      this.magentoApi,
      query.collectionName,
    );

    if (!category) {
      debug('Collection not found: %s', query.collectionName);
      return success([]);
    }

    try {
      const products = await fetchProductsInCategory(
        this.magentoApi,
        String(category.id),
        query.numberOfRecommendations,
      );

      return success(
        this.toRecommendations('collection', String(category.id), products),
      );
    } catch (err) {
      debug('Failed to load products for collection %s: %O', query.collectionName, err);
      return success([]);
    }
  }

  protected override async getRelatedProductsRecommendations(
    query: ProductRecommendationAlgorithmRelatedProductsQuery,
  ): Promise<ProductRecommendation[]> {
    const products = await this.fetchLinkedProducts(
      query.sourceProduct,
      this.getRelatedLinkType(),
      query.numberOfRecommendations,
    );
    return this.toRecommendations('related', query.sourceProduct.key, products);
  }

  protected override async getSimilarProductsRecommendations(
    query: ProductRecommendationAlgorithmSimilarProductsQuery,
  ): Promise<ProductRecommendation[]> {
    const products = await this.fetchLinkedProducts(
      query.sourceProduct,
      this.getSimilarLinkType(),
      query.numberOfRecommendations,
    );
    return this.toRecommendations('similar', query.sourceProduct.key, products);
  }

  protected override async getFrequentlyBoughtTogetherRecommendations(
    query: ProductRecommendationAlgorithmFrequentlyBoughtTogetherQuery,
  ): Promise<ProductRecommendation[]> {
    const products = await this.fetchLinkedProducts(
      query.sourceProduct,
      this.getFrequentlyBoughtTogetherLinkType(),
      query.numberOfRecommendations,
    );
    return this.toRecommendations(
      'frequentlyBoughtTogether',
      query.sourceProduct.key,
      products,
    );
  }

  protected override async getTrendingInCategoryRecommendations(
    query: ProductRecommendationAlgorithmTrendingInCategoryQuery,
  ): Promise<ProductRecommendation[]> {
    const category = await findCategoryByName(
      this.magentoApi,
      query.sourceCategory.key,
    );
    const categoryId = category ? String(category.id) : query.sourceCategory.key;

    try {
      const products = await fetchProductsInCategory(
        this.magentoApi,
        categoryId,
        query.numberOfRecommendations,
      );
      return this.toRecommendations('trendingInCategory', categoryId, products);
    } catch (err) {
      debug('Failed to load trending products for category %s: %O', categoryId, err);
      return [];
    }
  }
}
