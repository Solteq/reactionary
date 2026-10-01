import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type { ReactionaryFeedProduct, ReactionaryFeedVariant } from '../feed-types.js';
import {
  escapeXml,
  googleMoney,
  primaryImage,
  productDescription,
} from './shared.js';

export const googleMerchantFeedTransformer: ReactionaryFeedTransformer = {
  id: 'google-merchant-feed',
  title: 'Google Merchant Feed',
  description: 'Google Merchant Center RSS XML feed.',
  output: {
    contentType: 'application/xml; charset=utf-8',
    fileExtension: 'xml',
  },
  async *transform(products) {
    yield '<?xml version="1.0" encoding="UTF-8"?>\n';
    yield '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n';
    yield '<channel>\n';
    yield '<title>Reactionary Product Feed</title>\n';

    for await (const product of products) {
      for (const variant of product.variants) {
        yield toGoogleItem(product, variant);
      }
    }

    yield '</channel>\n';
    yield '</rss>\n';
  },
};

function toGoogleItem(
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
): string {
  const lines = [
    '<item>',
    tag('g:id', variant.id),
    tag('g:item_group_id', product.id),
    tag('title', variant.title || product.title),
    tag('description', variant.description ?? productDescription(product)),
    variant.url ? tag('link', variant.url) : product.url ? tag('link', product.url) : '',
    primaryImage(product, variant) ? tag('g:image_link', primaryImage(product, variant) ?? '') : '',
    tag('g:availability', variant.availability?.available ? 'in stock' : 'out of stock'),
    variant.price ? tag('g:price', googleMoney(variant.price) ?? '') : '',
    product.brand ? tag('g:brand', product.brand) : '',
    variant.barcodes.find((barcode) => barcode.type === 'gtin')?.value
      ? tag('g:gtin', variant.barcodes.find((barcode) => barcode.type === 'gtin')?.value ?? '')
      : '',
    tag('g:condition', 'new'),
    '</item>',
  ];

  return `${lines.filter(Boolean).join('\n')}\n`;
}

function tag(name: string, value: string): string {
  return `<${name}>${escapeXml(value)}</${name}>`;
}
