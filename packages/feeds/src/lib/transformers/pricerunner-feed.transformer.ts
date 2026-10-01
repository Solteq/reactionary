import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type { ReactionaryFeedProduct, ReactionaryFeedVariant } from '../feed-types.js';
import {
  cdata,
  escapeXml,
  formatMoney,
  primaryImage,
  productDescription,
} from './shared.js';

export const pricerunnerFeedTransformer: ReactionaryFeedTransformer = {
  id: 'pricerunner-feed',
  title: 'PriceRunner XML Feed',
  description: 'PriceRunner Products XML feed.',
  output: {
    contentType: 'application/xml; charset=utf-8',
    fileExtension: 'xml',
  },
  async *transform(products) {
    yield '<?xml version="1.0" encoding="UTF-8"?>\n';
    yield '<Products>\n';

    for await (const product of products) {
      for (const variant of product.variants) {
        yield toPriceRunnerProduct(product, variant);
      }
    }

    yield '</Products>\n';
  },
};

function toPriceRunnerProduct(
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
): string {
  const ean = variant.barcodes.find((barcode) => barcode.type === 'ean')?.value
    ?? variant.barcodes.find((barcode) => barcode.type === 'gtin')?.value;
  const lines = [
    '  <Product>',
    tag('ProductId', variant.id),
    cdataTag('ProductName', variant.title || product.title),
    variant.price ? tag('Price', formatMoney(variant.price) ?? '') : '',
    tag('StockStatus', variant.availability?.available ? 'in stock' : 'out of stock'),
    product.brand ? cdataTag('Brand', product.brand) : '',
    tag('Msku', variant.id),
    ean ? tag('Ean', ean) : '',
    variant.url ? tag('Url', variant.url) : product.url ? tag('Url', product.url) : '',
    primaryImage(product, variant) ? tag('ImageUrl', primaryImage(product, variant) ?? '') : '',
    cdataTag('Description', variant.description ?? productDescription(product)),
    tag('Condition', 'New'),
    tag('GroupId', product.id),
    ...variant.options.map((option) => cdataTag(option.name, option.value)),
    '  </Product>',
  ];

  return `${lines.filter(Boolean).join('\n')}\n`;
}

function tag(name: string, value: string): string {
  return `\t<${name}>${escapeXml(value)}</${name}>`;
}

function cdataTag(name: string, value: string): string {
  return `\t<${name}>${cdata(value)}</${name}>`;
}
