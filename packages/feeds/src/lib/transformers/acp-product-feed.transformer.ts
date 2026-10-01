import {
  getTargetCountry,
} from '../feed-generator.js';
import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type {
  ReactionaryFeedProduct,
  ReactionaryFeedVariant,
} from '../feed-types.js';
import { toMinorUnits } from './shared.js';

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
        collected.push(toACPProduct(product));
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
      yield `${JSON.stringify(toACPProduct(product))}\n`;
    }
  },
};

function toACPProduct(product: ReactionaryFeedProduct): Record<string, unknown> {
  return {
    id: product.id,
    title: product.title,
    ...(product.description ? { description: { plain: product.description } } : {}),
    ...(product.url ? { url: product.url } : {}),
    ...(product.images.length > 0
      ? {
          media: product.images.map((image) => ({
            url: image.url,
            ...(image.altText ? { alt_text: image.altText } : {}),
          })),
        }
      : {}),
    variants: product.variants.map(toACPVariant),
  };
}

function toACPVariant(variant: ReactionaryFeedVariant): Record<string, unknown> {
  return {
    id: variant.id,
    title: variant.title,
    ...(variant.description ? { description: { plain: variant.description } } : {}),
    ...(variant.url ? { url: variant.url } : {}),
    ...(variant.barcodes.length > 0 ? { barcodes: variant.barcodes } : {}),
    ...(variant.price
      ? {
          price: {
            amount: toMinorUnits(variant.price.value),
            currency: variant.price.currency.toUpperCase(),
          },
        }
      : {}),
    ...(variant.listPrice
      ? {
          list_price: {
            amount: toMinorUnits(variant.listPrice.value),
            currency: variant.listPrice.currency.toUpperCase(),
          },
        }
      : {}),
    ...(variant.availability
      ? {
          availability: {
            available: variant.availability.available,
            status: variant.availability.status,
          },
        }
      : {}),
    ...(variant.options.length > 0
      ? {
          variant_options: variant.options.map((option) => ({
            name: option.name,
            value: option.value,
          })),
        }
      : {}),
    ...(variant.images.length > 0
      ? {
          media: variant.images.map((image) => ({
            url: image.url,
            ...(image.altText ? { alt_text: image.altText } : {}),
          })),
        }
      : {}),
  };
}
