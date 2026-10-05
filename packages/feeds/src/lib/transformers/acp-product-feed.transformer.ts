import {
  getTargetCountry,
} from '../feed-generator.js';
import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type {
  ReactionaryFeedDefinition,
  ReactionaryFeedImage,
  ReactionaryFeedMoney,
  ReactionaryFeedProduct,
  ReactionaryFeedVariant,
} from '../feed-types.js';

/** ACP Feed API `Price`: minor units and an upper-case ISO 4217 code. */
export interface ACPFeedPrice {
  amount: number;
  currency: string;
}

export interface ACPFeedDescription {
  plain?: string;
  html?: string;
  markdown?: string;
}

export interface ACPFeedMedia {
  type: string;
  url: string;
  alt_text?: string;
}

export interface ACPFeedAvailability {
  available?: boolean;
  status?: string;
}

export interface ACPFeedVariant {
  id: string;
  title: string;
  description?: ACPFeedDescription;
  url?: string;
  barcodes?: Array<{ type: string; value: string }>;
  price?: ACPFeedPrice;
  list_price?: ACPFeedPrice;
  availability?: ACPFeedAvailability;
  categories?: Array<{ value: string; taxonomy?: string }>;
  variant_options?: Array<{ name: string; value: string }>;
  media?: ACPFeedMedia[];
  seller?: { name?: string };
}

/** ACP Feed API `Product` (2026-04-17), one line of `products.jsonl`. */
export interface ACPFeedProduct {
  id: string;
  title?: string;
  description?: ACPFeedDescription;
  url?: string;
  media?: ACPFeedMedia[];
  variants: ACPFeedVariant[];
}

/** ACP Feed API `FeedMetadata`, the content of `metadata.json`. */
export interface ACPFeedMetadata {
  id: string;
  target_country?: string;
  updated_at?: string;
}

/**
 * The ACP product feed (Feed API 2026-04-17): `jsonl` writes
 * `products.jsonl` for file ingestion, one `Product` per line; `json` writes
 * `{ "products": [...] }`, the body of `PATCH /feeds/{id}/products`.
 */
export const acpProductFeedTransformer: ReactionaryFeedTransformer<{
  format?: 'jsonl' | 'json';
}> = {
  id: 'acp-product-feed',
  title: 'ACP Product Feed',
  description: 'Agentic Commerce Protocol Feed API products (2026-04-17).',
  output: {
    contentType: 'application/x-ndjson; charset=utf-8',
    fileExtension: 'jsonl',
  },
  defaultOptions: {
    format: 'jsonl',
  },
  async *transform(products, context) {
    if (context.options.format === 'json') {
      const collected: ACPFeedProduct[] = [];
      for await (const product of products) {
        const acpProduct = toACPFeedProduct(product, context.feed);
        if (acpProduct) {
          collected.push(acpProduct);
        }
      }

      yield JSON.stringify({ products: collected });
      return;
    }

    for await (const product of products) {
      const acpProduct = toACPFeedProduct(product, context.feed);
      if (acpProduct) {
        yield `${JSON.stringify(acpProduct)}\n`;
      }
    }
  },
};

/**
 * The ACP feed's `metadata.json` for file ingestion, alongside the
 * `acp-product-feed` products.jsonl. Products are not read.
 */
export const acpFeedMetadataTransformer: ReactionaryFeedTransformer = {
  id: 'acp-feed-metadata',
  title: 'ACP Feed Metadata',
  description: 'Agentic Commerce Protocol Feed API metadata.json (2026-04-17).',
  output: {
    contentType: 'application/json; charset=utf-8',
    fileExtension: 'json',
  },
  async *transform(_products, context) {
    yield JSON.stringify(toACPFeedMetadata(context.feedId, context.feed));
  },
};

/** The feed's `metadata.json`: its id, target country and generation time. */
export function toACPFeedMetadata(
  feedId: string,
  feed: ReactionaryFeedDefinition,
  updatedAt: Date = new Date(),
): ACPFeedMetadata {
  const targetCountry = getTargetCountry(feed.languageContext);

  return {
    id: feedId,
    ...(targetCountry ? { target_country: targetCountry } : {}),
    updated_at: updatedAt.toISOString(),
  };
}

/**
 * A feed product as an ACP `Product`. Products need at least one variant,
 * so a product without variants is left out (undefined).
 */
export function toACPFeedProduct(
  product: ReactionaryFeedProduct,
  feed: Pick<ReactionaryFeedDefinition, 'sellerName'>,
): ACPFeedProduct | undefined {
  if (product.variants.length === 0) {
    return undefined;
  }

  const media = toMedia(product.images);
  const categoryPath = product.categoryPath?.map((category) => category.name).join(' > ');

  return {
    id: product.id,
    title: product.title,
    ...(product.description ? { description: { plain: product.description } } : {}),
    ...(product.url ? { url: product.url } : {}),
    ...(media.length > 0 ? { media } : {}),
    variants: product.variants.map((variant) => toACPFeedVariant(variant, categoryPath, feed.sellerName)),
  };
}

function toACPFeedVariant(
  variant: ReactionaryFeedVariant,
  categoryPath: string | undefined,
  sellerName: string | undefined,
): ACPFeedVariant {
  const media = toMedia(variant.images);
  const price = toFeedPrice(variant.price ?? variant.listPrice);
  const listPrice = variant.price ? toFeedPrice(variant.listPrice) : undefined;

  return {
    id: variant.id,
    title: variant.title,
    ...(variant.description ? { description: { plain: variant.description } } : {}),
    ...(variant.url ? { url: variant.url } : {}),
    ...(variant.barcodes.length > 0
      ? { barcodes: variant.barcodes.map((barcode) => ({ type: barcode.type, value: barcode.value })) }
      : {}),
    ...(price ? { price } : {}),
    // The regular price, reported when the selling price is below it.
    ...(listPrice && price && listPrice.currency === price.currency && listPrice.amount > price.amount
      ? { list_price: listPrice }
      : {}),
    ...(variant.availability
      ? { availability: { available: variant.availability.available, status: variant.availability.status } }
      : {}),
    ...(categoryPath ? { categories: [{ value: categoryPath }] } : {}),
    ...(variant.options.length > 0
      ? { variant_options: variant.options.map((option) => ({ name: option.name, value: option.value })) }
      : {}),
    ...(media.length > 0 ? { media } : {}),
    ...(sellerName ? { seller: { name: sellerName } } : {}),
  };
}

function toMedia(images: ReactionaryFeedImage[]): ACPFeedMedia[] {
  return images
    .filter((image) => image.url.length > 0)
    .map((image) => ({
      type: 'image',
      url: image.url,
      ...(image.altText ? { alt_text: image.altText } : {}),
    }));
}

// ISO 4217 exponents that differ from the common 2.
const CURRENCY_EXPONENTS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0,
  RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

function toFeedPrice(money: ReactionaryFeedMoney | undefined): ACPFeedPrice | undefined {
  if (!money) {
    return undefined;
  }

  const currency = money.currency.toUpperCase();
  const exponent = CURRENCY_EXPONENTS[currency] ?? 2;

  return {
    amount: Math.max(Math.round(money.value * 10 ** exponent), 0),
    currency,
  };
}
