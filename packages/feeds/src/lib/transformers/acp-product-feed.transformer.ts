import {
  getTargetCountry,
} from '../feed-generator.js';
import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type {
  ReactionaryFeedAvailability,
  ReactionaryFeedProduct,
  ReactionaryFeedVariant,
} from '../feed-types.js';
import {
  formatMoney,
  primaryImage,
  productDescription,
} from './shared.js';

export const acpProductFeedTransformer: ReactionaryFeedTransformer<{
  format?: 'jsonl' | 'json';
}> = {
  id: 'acp-product-feed',
  title: 'ACP Product Feed',
  description: 'Agentic Commerce Protocol product feed output.',
  output: {
    contentType: 'application/x-ndjson; charset=utf-8',
    fileExtension: 'jsonl',
  },
  defaultOptions: {
    format: 'jsonl',
  },
  async *transform(products, context) {
    if (context.options.format === 'json') {
      const collected: unknown[] = [];
      for await (const product of products) {
        collected.push(...toACPRows(product, context.feed));
      }

      yield JSON.stringify({
        ...(getTargetCountry(context.feed.languageContext)
          ? { target_country: getTargetCountry(context.feed.languageContext) }
          : {}),
        products: collected,
      });
      return;
    }

    for await (const product of products) {
      for (const row of toACPRows(product, context.feed)) {
        yield `${JSON.stringify(row)}\n`;
      }
    }
  },
};

function toACPRows(
  product: ReactionaryFeedProduct,
  feed: Parameters<ReactionaryFeedTransformer['transform']>[1]['feed'],
): Array<Record<string, unknown>> {
  return product.variants.map((variant) =>
    toACPRow(product, variant, feed),
  );
}

function toACPRow(
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
  feed: Parameters<ReactionaryFeedTransformer['transform']>[1]['feed'],
): Record<string, unknown> {
  const primaryImageUrl = primaryImage(product, variant);
  const additionalImageUrls = getAdditionalImageUrls(product, variant, primaryImageUrl);
  const variation = getVariationFields(product, variant);
  const priceFields = getPriceFields(variant);
  const gtin = variant.gtin || variant.ean || variant.upc || undefined;

  return {
    item_id: variant.id,
    ...variation,
    title: variant.title || product.title,
    description: variant.description ?? productDescription(product),
    ...(variant.url ?? product.url ? { url: variant.url ?? product.url } : {}),
    ...(product.brand ? { brand: product.brand } : {}),
    is_eligible_search: true,
    ...(feed.sellerName ? { seller_name: feed.sellerName } : {}),
    ...(product.manufacturer ? { manufacturer: product.manufacturer } : {}),
    ...(product.categoryPath?.length
      ? {
          product_category: product.categoryPath.map((category) => category.name).join(' > '),
        }
      : {}),
    ...(product.ratingSummary
      ? {
          ...(product.ratingSummary.totalRatings !== undefined
            ? { review_count: product.ratingSummary.totalRatings }
            : {}),
          ...(product.ratingSummary.totalRatings
            ? { star_rating: product.ratingSummary.averageRating.toFixed(2) }
            : {}),
        }
      : {}),
    ...(primaryImageUrl ? { image_url: primaryImageUrl } : {}),
    ...(additionalImageUrls.length > 0
      ? { additional_image_urls: additionalImageUrls }
      : {}),
    availability: toACPAvailability(variant.availability?.status),
    ...priceFields,
    ...(gtin ? { gtin } : {}),
    ...(variant.manufacturerPartNumber
      ? { mpn: variant.manufacturerPartNumber }
      : {}),
  };
}

function getVariationFields(
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
): Record<string, unknown> {
  if (
    product.variants.length <= 1 ||
    product.id === variant.id ||
    variant.options.length === 0
  ) {
    return {};
  }

  const variantDict = Object.fromEntries(
    variant.options.map((option) => [option.name, option.value]),
  );

  return {
    group_id: product.id,
    listing_has_variations: true,
    variant_dict: variantDict,
  };
}

function getPriceFields(
  variant: ReactionaryFeedVariant,
): Record<string, unknown> {
  if (
    variant.price &&
    variant.listPrice &&
    variant.price.currency.toUpperCase() === variant.listPrice.currency.toUpperCase() &&
    variant.price.value > 0 &&
    variant.listPrice.value > variant.price.value
  ) {
    return {
      price: formatMoney(variant.listPrice),
      sale_price: formatMoney(variant.price),
    };
  }

  return {
    ...(variant.price ?? variant.listPrice
      ? { price: formatMoney(variant.price ?? variant.listPrice) }
      : {}),
  };
}

function toACPAvailability(
  status: ReactionaryFeedAvailability['status'] | undefined,
): string {
  switch (status) {
    case 'in_stock':
    case 'out_of_stock':
    case 'backorder':
      return status;
    case 'preorder':
      return 'pre_order';
    default:
      return 'unknown';
  }
}

function getAdditionalImageUrls(
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
  primaryImageUrl: string | undefined,
): string[] {
  const urls = [
    ...variant.images.map((image) => image.url),
    ...product.images.map((image) => image.url),
  ];
  const unique = new Set<string>();

  return urls.filter((url) => {
    if (url === primaryImageUrl || unique.has(url)) {
      return false;
    }

    unique.add(url);
    return true;
  });
}
