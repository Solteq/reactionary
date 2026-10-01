import type {
  Category,
  Inventory,
  Product,
  ProductRatingSummary,
  ProductReview,
  ProductSearchResult,
  RequestContext,
} from '@reactionary/core';
import {
  assertReactionaryFeedClient,
  type ReactionaryFeedAvailability,
  type ReactionaryFeedBarcode,
  type ReactionaryFeedCategory,
  type ReactionaryFeedClient,
  type ReactionaryFeedDefinition,
  type ReactionaryFeedGeneratorOptions,
  type ReactionaryFeedImage,
  type ReactionaryFeedProduct,
  type ReactionaryFeedRatingSummary,
  type ReactionaryFeedReview,
  type ReactionaryFeedVariant,
  type ValidatedReactionaryFeedClient,
} from './feed-types.js';

export class ReactionaryFeedGenerator {
  private readonly client: ValidatedReactionaryFeedClient;

  public constructor(
    client: ReactionaryFeedClient,
    private readonly options: ReactionaryFeedGeneratorOptions = {},
  ) {
    assertReactionaryFeedClient(client);
    this.client = client;
  }

  public async *products(
    feed: ReactionaryFeedDefinition,
    requestContext: RequestContext,
  ): AsyncGenerator<ReactionaryFeedProduct> {
    requestContext.languageContext = feed.languageContext;

    const pageSize =
      feed.pageSize ?? feed.search.paginationOptions.pageSize ?? 50;
    const maxPages = feed.maxPages ?? 100;
    const productConcurrency = normalizeProductConcurrency(
      this.options.productConcurrency,
    );
    const startedAt = Date.now();
    let processedProducts = 0;
    let totalProducts: number | undefined = undefined;
    let pageNumber = 1;

    this.reportProgress({
      phase: 'searching',
      processedProducts,
      elapsedMs: Date.now() - startedAt,
    });

    while (pageNumber <= maxPages) {
      const result = await unwrapFeedResult(
        this.client.productSearch.queryByTerm({
          search: {
            ...feed.search,
            paginationOptions: {
              ...feed.search.paginationOptions,
              pageNumber,
              pageSize,
            },
          },
        }),
      );
      totalProducts = estimateTotalProducts(result, pageSize, maxPages);
      const totalPages = Math.min(result.totalPages, maxPages);

      this.reportProgress({
        phase: 'generating',
        processedProducts,
        totalProducts,
        pageNumber,
        totalPages,
        elapsedMs: Date.now() - startedAt,
      });

      for (const batch of chunks(result.items, productConcurrency)) {
        const products = await Promise.all(
          batch.map((item) => this.toFeedProduct(item, feed)),
        );

        for (const product of products) {
          if (product) {
            processedProducts += 1;
            this.reportProgress({
              phase: 'generating',
              processedProducts,
              totalProducts,
              pageNumber,
              totalPages,
              elapsedMs: Date.now() - startedAt,
            });
            yield product;
          }
        }
      }

      if (pageNumber >= result.totalPages || result.items.length === 0) {
        this.reportProgress({
          phase: 'completed',
          processedProducts,
          totalProducts,
          pageNumber,
          totalPages,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      }

      pageNumber += 1;
    }

    this.reportProgress({
      phase: 'completed',
      processedProducts,
      totalProducts,
      pageNumber: pageNumber - 1,
      totalPages: totalProducts === undefined ? undefined : maxPages,
      elapsedMs: Date.now() - startedAt,
    });
  }

  private async toFeedProduct(
    item: ProductSearchResult['items'][number],
    feed: ReactionaryFeedDefinition,
  ): Promise<ReactionaryFeedProduct | undefined> {
    const firstVariant = item.variants[0]?.variant;

    if (!firstVariant) {
      return undefined;
    }

    const productResult = await this.client.product.getBySKU({
      variant: firstVariant,
    });
    const product = productResult.success ? productResult.value : undefined;
    const variants = await Promise.all(
      item.variants.map((variant) =>
        this.toFeedVariant(item, product, variant.variant.sku, feed),
      ),
    );
    const images = uniqueImages([
      ...toFeedImages(product?.mainVariant.images ?? []),
      ...item.variants.flatMap((variant) => toFeedImages([variant.image])),
    ]);
    const [categoryPath, reviewData] = product
      ? await Promise.all([
          this.getCategoryPath(product),
          this.getReviewData(product),
        ])
      : [undefined, undefined];

    return {
      id: product?.identifier.key ?? item.identifier.key,
      title: product?.name ?? item.name,
      description: product?.description || product?.longDescription,
      url: toProductUrl(product?.slug ?? item.slug, feed),
      brand: product?.brand,
      manufacturer: product?.manufacturer,
      ...(categoryPath && categoryPath.length > 0 ? { categoryPath } : {}),
      ...(reviewData?.ratingSummary ? { ratingSummary: reviewData.ratingSummary } : {}),
      ...(reviewData?.reviews?.length ? { reviews: reviewData.reviews } : {}),
      images,
      variants,
    };
  }

  private async toFeedVariant(
    item: ProductSearchResult['items'][number],
    product: Product | undefined,
    sku: string,
    feed: ReactionaryFeedDefinition,
  ): Promise<ReactionaryFeedVariant> {
    const variant = product?.variants.find(
      (productVariant) => productVariant.identifier.sku === sku,
    ) ?? product?.mainVariant;
    const [customerPriceResult, listPriceResult, inventory] =
      await Promise.all([
        this.client.price.getCustomerPrice({ variant: { sku } }),
        this.client.price.getListPrice({ variant: { sku } }),
        this.getInventoryBySKU(sku, feed),
      ]);
    const customerPrice = customerPriceResult.success
      ? {
          value: customerPriceResult.value.unitPrice.value,
          currency: customerPriceResult.value.unitPrice.currency,
        }
      : undefined;
    const listPrice = listPriceResult.success
      ? {
          value: listPriceResult.value.unitPrice.value,
          currency: listPriceResult.value.unitPrice.currency,
        }
      : undefined;
    const availability = inventory
      ? toFeedAvailability(inventory)
      : undefined;

    return {
      id: sku,
      title: variant?.name || item.name,
      description: product?.description,
      url: toProductUrl(product?.slug ?? item.slug, feed),
      ...(variant?.ean ? { ean: variant.ean } : {}),
      ...(variant?.gtin ? { gtin: variant.gtin } : {}),
      ...(variant?.upc ? { upc: variant.upc } : {}),
      ...(variant?.barcode ? { barcode: variant.barcode } : {}),
      manufacturerPartNumber: sku,
      images: uniqueImages(toFeedImages(variant?.images ?? [])),
      price: customerPrice,
      listPrice,
      availability,
      barcodes: toFeedBarcodes(variant),
      options: variant?.options.map((option) => ({
        name: option.name,
        value: option.value.label || option.value.identifier.key,
      })) ?? [],
    };
  }

  private async getInventoryBySKU(
    sku: string,
    feed: ReactionaryFeedDefinition,
  ): Promise<Inventory | undefined> {
    const fulfillmentCenterKeys = getFulfillmentCenterKeys(
      feed,
      this.options.defaultFulfillmentCenterKeys,
    );
    const inventoryResults = await Promise.all(
      fulfillmentCenterKeys.map((fulfillmentCenterKey) =>
        this.client.inventory.getBySKU({
          variant: { sku },
          fulfilmentCenter: {
            key: fulfillmentCenterKey,
          },
        }),
      ),
    );
    const inventories = inventoryResults
      .filter((result) => result.success)
      .map((result) => result.value);

    if (inventories.length === 0) {
      return undefined;
    }

    if (inventories.length === 1) {
      return inventories[0];
    }

    return combineInventory(sku, inventories);
  }

  private async getCategoryPath(
    product: Product,
  ): Promise<ReactionaryFeedCategory[] | undefined> {
    const category = this.client.category;
    const getBreadcrumbPathToCategory = category?.getBreadcrumbPathToCategory;
    const parentCategory = product.parentCategories[0];

    if (!getBreadcrumbPathToCategory || !parentCategory) {
      return undefined;
    }

    const result = await getBreadcrumbPathToCategory.call(category, {
      id: parentCategory,
    });

    if (!result.success) {
      throw new Error(JSON.stringify(result.error));
    }

    return result.value.map(toFeedCategory);
  }

  private async getReviewData(
    product: Product,
  ): Promise<{
    ratingSummary?: ReactionaryFeedRatingSummary;
    reviews?: ReactionaryFeedReview[];
  } | undefined> {
    const productReviews = this.client.productReviews;

    if (!productReviews) {
      return undefined;
    }

    const [summaryResult, reviewsResult] = await Promise.all([
      productReviews.getRatingSummary({
        product: product.identifier,
      }),
      productReviews.findReviews({
        product: product.identifier,
        paginationOptions: {
          pageNumber: 1,
          pageSize: 3,
        },
      }),
    ]);

    if (!summaryResult.success) {
      throw new Error(JSON.stringify(summaryResult.error));
    }

    if (!reviewsResult.success) {
      throw new Error(JSON.stringify(reviewsResult.error));
    }

    return {
      ratingSummary: toFeedRatingSummary(summaryResult.value),
      reviews: reviewsResult.value.items.map(toFeedReview),
    };
  }

  private reportProgress(
    progress: Parameters<NonNullable<ReactionaryFeedGeneratorOptions['onProgress']>>[0],
  ): void {
    this.options.onProgress?.(progress);
  }
}

async function unwrapFeedResult<T>(
  resultPromise: Promise<{ success: true; value: T } | { success: false; error: unknown }>,
): Promise<T> {
  const result = await resultPromise;

  if (!result.success) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value;
}

function toFeedAvailability(inventory: Inventory): ReactionaryFeedAvailability {
  return {
    available: inventory.status === 'inStock' && inventory.quantity > 0,
    status: toFeedAvailabilityStatus(inventory.status),
    quantity: inventory.quantity,
  };
}

function toFeedCategory(category: Category): ReactionaryFeedCategory {
  return {
    id: category.identifier.key,
    name: category.name,
    ...(category.slug ? { slug: category.slug } : {}),
  };
}

function toFeedRatingSummary(
  summary: ProductRatingSummary,
): ReactionaryFeedRatingSummary {
  return {
    averageRating: summary.averageRating,
    ...(summary.totalRatings !== undefined
      ? { totalRatings: summary.totalRatings }
      : {}),
    ...(summary.ratingDistribution
      ? { ratingDistribution: summary.ratingDistribution as Record<string, number> }
      : {}),
  };
}

function toFeedReview(review: ProductReview): ReactionaryFeedReview {
  return {
    id: review.identifier.key,
    authorName: review.authorName,
    rating: review.rating,
    title: review.title,
    content: review.content,
    createdAt: review.createdAt,
    verified: review.verified,
  };
}

function estimateTotalProducts(
  result: ProductSearchResult,
  pageSize: number,
  maxPages: number,
): number {
  return Math.min(result.totalCount, Math.min(result.totalPages, maxPages) * pageSize);
}

function normalizeProductConcurrency(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.floor(value));
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function toFeedAvailabilityStatus(
  status: Inventory['status'],
): ReactionaryFeedAvailability['status'] {
  switch (status) {
    case 'inStock':
      return 'in_stock';
    case 'onBackOrder':
      return 'backorder';
    case 'preOrder':
      return 'preorder';
    case 'discontinued':
      return 'discontinued';
    case 'outOfStock':
    default:
      return 'out_of_stock';
  }
}

function getFulfillmentCenterKeys(
  feed: ReactionaryFeedDefinition,
  defaultFulfillmentCenterKeys: string[] | undefined,
): string[] {
  const keys = feed.fulfillmentCenterKeys?.length
    ? feed.fulfillmentCenterKeys
    : feed.fulfillmentCenterKey
      ? [feed.fulfillmentCenterKey]
      : defaultFulfillmentCenterKeys?.length
        ? defaultFulfillmentCenterKeys
        : [''];

  return [...new Set(keys.map((key) => key.trim()))];
}

function combineInventory(
  sku: string,
  inventories: Inventory[],
): Inventory {
  return {
    identifier: {
      variant: { sku },
      fulfillmentCenter: {
        key: inventories.map((inventory) =>
          inventory.identifier.fulfillmentCenter.key,
        ).join(','),
      },
    },
    quantity: inventories.reduce((total, inventory) => total + inventory.quantity, 0),
    status: getCombinedInventoryStatus(inventories),
  };
}

function getCombinedInventoryStatus(
  inventories: Inventory[],
): Inventory['status'] {
  if (inventories.some((inventory) =>
    inventory.status === 'inStock' && inventory.quantity > 0,
  )) {
    return 'inStock';
  }

  if (inventories.some((inventory) => inventory.status === 'onBackOrder')) {
    return 'onBackOrder';
  }

  if (inventories.some((inventory) => inventory.status === 'preOrder')) {
    return 'preOrder';
  }

  if (inventories.every((inventory) => inventory.status === 'discontinued')) {
    return 'discontinued';
  }

  return 'outOfStock';
}

function toFeedImages(
  images: Array<{ sourceUrl: string; altText: string }>,
): ReactionaryFeedImage[] {
  return images
    .filter((image) => image.sourceUrl.length > 0)
    .map((image) => ({
      url: image.sourceUrl,
      ...(image.altText ? { altText: image.altText } : {}),
    }));
}

function uniqueImages(images: ReactionaryFeedImage[]): ReactionaryFeedImage[] {
  const seen = new Set<string>();

  return images.filter((image) => {
    if (seen.has(image.url)) {
      return false;
    }

    seen.add(image.url);
    return true;
  });
}

function toFeedBarcodes(
  variant: Product['mainVariant'] | undefined,
): ReactionaryFeedBarcode[] {
  if (!variant) {
    return [];
  }

  return [
    ['ean', variant.ean],
    ['gtin', variant.gtin],
    ['upc', variant.upc],
    ['barcode', variant.barcode],
  ]
    .filter(([, value]) => value.length > 0)
    .map(([type, value]) => ({
      type: type as ReactionaryFeedBarcode['type'],
      value,
    }));
}

export function toProductUrl(
  slug: string | undefined,
  feed: ReactionaryFeedDefinition,
): string | undefined {
  if (!slug || !feed.productUrlBase) {
    return undefined;
  }

  if (feed.productUrlBase.includes('{slug}') || feed.productUrlBase.includes('{lang}')) {
    return feed.productUrlBase
      .replaceAll('{lang}', getLanguage(feed.languageContext))
      .replaceAll('{slug}', encodeURIComponent(slug));
  }

  return new URL(slug, feed.productUrlBase).href;
}

export function getLanguage(feed: ReactionaryFeedDefinition['languageContext']): string {
  const [language] = feed.locale.split('-');
  return language.toLowerCase();
}

export function getTargetCountry(
  feed: ReactionaryFeedDefinition['languageContext'],
): string | undefined {
  const [, region] = feed.locale.split('-');
  return region?.toUpperCase();
}
