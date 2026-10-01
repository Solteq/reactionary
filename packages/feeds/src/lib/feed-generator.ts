import type {
  Inventory,
  Product,
  ProductSearchResult,
  RequestContext,
} from '@reactionary/core';
import {
  assertReactionaryFeedClient,
  type ReactionaryFeedAvailability,
  type ReactionaryFeedBarcode,
  type ReactionaryFeedClient,
  type ReactionaryFeedDefinition,
  type ReactionaryFeedImage,
  type ReactionaryFeedProduct,
  type ReactionaryFeedVariant,
  type ValidatedReactionaryFeedClient,
} from './feed-types.js';

export class ReactionaryFeedGenerator {
  private readonly client: ValidatedReactionaryFeedClient;

  public constructor(client: ReactionaryFeedClient) {
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
    let pageNumber = 1;

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

      for (const item of result.items) {
        const product = await this.toFeedProduct(item, feed);

        if (product) {
          yield product;
        }
      }

      if (pageNumber >= result.totalPages || result.items.length === 0) {
        return;
      }

      pageNumber += 1;
    }
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

    return {
      id: product?.identifier.key ?? item.identifier.key,
      title: product?.name ?? item.name,
      description: product?.description || product?.longDescription,
      url: toProductUrl(product?.slug ?? item.slug, feed),
      brand: product?.brand,
      manufacturer: product?.manufacturer,
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
    const [customerPriceResult, listPriceResult, inventoryResult] =
      await Promise.all([
        this.client.price.getCustomerPrice({ variant: { sku } }),
        this.client.price.getListPrice({ variant: { sku } }),
        this.client.inventory.getBySKU({
          variant: { sku },
          fulfilmentCenter: {
            key: feed.fulfillmentCenterKey ?? '',
          },
        }),
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
    const availability = inventoryResult.success
      ? toFeedAvailability(inventoryResult.value)
      : undefined;

    return {
      id: sku,
      title: variant?.name || item.name,
      description: product?.description,
      url: toProductUrl(product?.slug ?? item.slug, feed),
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
