import {
  ProductRecommendationSchema,
  ProductRecommendationsByCollectionQuerySchema,
  ProductRecommendationsCapability,
  ProductRecommendationsQuerySchema,
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
  type ProductRecommendationsQuery,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
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
  getProductCategoryIds,
  handleMagentoLookupError,
  MagentoLookupNotFoundError,
  requireCategoryByKey,
  requireProductSku,
} from '../utils/magento-product-lookup.js';
import {
  buildProductSearchResultItem,
  getProductKey,
} from '../utils/magento-product.js';

const debug = createDebug('reactionary:magento:product-recommendations');

/** Upper bound for over-fetching when results are filtered client-side. */
const MAX_CANDIDATES = 100;

/**
 * Magento has no recommendation engine, so recommendations are derived from the
 * catalogue itself:
 * - `related` / `similar` / `frequentlyBoughtTogether`: the native related,
 *   up-sell and cross-sell product links of the source product;
 * - `trendingInCategory`: the newest products (by `created_at`) assigned to
 *   the category. Magento core keeps no sales or view statistics reachable
 *   over REST/GraphQL, so recency is the closest honest signal;
 * - `popular`, `topPicks`, `alsoViewed`: no Magento source (bestsellers and
 *   view reports are admin-only reports; Adobe Commerce Product
 *   Recommendations is a separate SaaS), so they keep the core default of an
 *   empty list.
 *
 * `labels` and `personalizationProfile` have no Magento counterpart and are
 * ignored. Only enabled, catalog-visible products are ever returned.
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

  /** The product field the trending-in-category algorithm sorts on, newest first. */
  protected getTrendingSortField(): string {
    return 'created_at';
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

  /**
   * Loads the enabled, catalog-visible products linked to `sourceProduct`.
   * Throws when the product cannot be resolved or Magento fails.
   */
  protected async fetchLinkedProducts(
    sourceProduct: ProductIdentifier,
    linkType: MagentoProductLinkType,
    numberOfRecommendations: number,
  ): Promise<MagentoProduct[]> {
    const sku = await requireProductSku(this.magentoApi, sourceProduct.key);
    const links = await this.magentoApi.getProductLinks(sku, linkType);
    const linkedSkus = [...links]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((link) => link.linked_product_sku)
      // Over-fetch so hidden or disabled links do not leave the result short.
      .slice(0, Math.max(numberOfRecommendations * 3, 20));

    const products = await fetchProductsBySkus(this.magentoApi, linkedSkus);
    return products.slice(0, numberOfRecommendations);
  }

  @Reactionary({
    inputSchema: ProductRecommendationsQuerySchema,
    outputSchema: z.array(ProductRecommendationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getRecommendations(
    query: ProductRecommendationsQuery,
  ): Promise<Result<ProductRecommendation[]>> {
    try {
      return await super.getRecommendations(query);
    } catch (err) {
      const identifier =
        'sourceProduct' in query
          ? query.sourceProduct
          : 'sourceCategory' in query
            ? query.sourceCategory
            : undefined;
      return handleMagentoLookupError(
        `load ${query.algorithm} recommendations`,
        err,
        identifier,
      );
    }
  }

  /**
   * A collection is a Magento category found by `external_id`, `url_key` or
   * `name`. `sourceProduct` entries are left out of the result (they are
   * already on screen), and `sourceCategory` narrows the collection to the
   * products that are also assigned to that category.
   */
  @Reactionary({
    inputSchema: ProductRecommendationsByCollectionQuerySchema,
    outputSchema: z.array(ProductRecommendationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getCollection(
    query: ProductRecommendationsByCollectionQuery,
  ): Promise<Result<ProductRecommendation[]>> {
    try {
      const category = await findCategoryByName(
        this.magentoApi,
        query.collectionName,
      );
      if (!category) {
        debug('Collection not found: %s', query.collectionName);
        throw new MagentoLookupNotFoundError('category', query.collectionName);
      }

      const sourceCategoryId = query.sourceCategory
        ? String(
            (await requireCategoryByKey(this.magentoApi, query.sourceCategory.key))
              .id,
          )
        : undefined;
      const excludedKeys = new Set(
        (query.sourceProduct ?? []).map((product) => product.key),
      );

      const candidateCount = sourceCategoryId
        ? Math.min(MAX_CANDIDATES, query.numberOfRecommendations * 5)
        : Math.min(
            MAX_CANDIDATES,
            query.numberOfRecommendations + excludedKeys.size,
          );

      const candidates = await fetchProductsInCategory(
        this.magentoApi,
        String(category.id),
        candidateCount,
      );

      const products = candidates
        .filter((product) => !excludedKeys.has(getProductKey(product)))
        .filter(
          (product) =>
            !sourceCategoryId ||
            getProductCategoryIds(product).includes(sourceCategoryId),
        )
        .slice(0, query.numberOfRecommendations);

      return success(
        this.toRecommendations('collection', String(category.id), products),
      );
    } catch (err) {
      return handleMagentoLookupError(
        `load collection ${query.collectionName}`,
        err,
        { collectionName: query.collectionName },
      );
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

  /**
   * The newest enabled, catalog-visible products assigned directly to the
   * category (see {@link getTrendingSortField}). Throws when the category key
   * does not resolve.
   */
  protected override async getTrendingInCategoryRecommendations(
    query: ProductRecommendationAlgorithmTrendingInCategoryQuery,
  ): Promise<ProductRecommendation[]> {
    const category = await requireCategoryByKey(
      this.magentoApi,
      query.sourceCategory.key,
    );

    const products = await fetchProductsInCategory(
      this.magentoApi,
      String(category.id),
      query.numberOfRecommendations,
      { sortField: this.getTrendingSortField(), sortDirection: 'DESC' },
    );
    return this.toRecommendations(
      'trendingInCategory',
      query.sourceCategory.key,
      products,
    );
  }
}
