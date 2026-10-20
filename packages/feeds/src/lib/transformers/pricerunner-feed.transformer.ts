import { create } from 'xmlbuilder2';
import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type { ReactionaryFeedProduct, ReactionaryFeedVariant } from '../feed-types.js';
import {
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
    const document = create({ version: '1.0', encoding: 'UTF-8' });
    const root = document.ele('Products');

    for await (const product of products) {
      for (const variant of product.variants) {
        appendPriceRunnerProduct(root, product, variant);
      }
    }

    yield `${document.end({ prettyPrint: true })}\n`;
  },
};

function appendPriceRunnerProduct(
  root: ReturnType<ReturnType<typeof create>['ele']>,
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
): void {
  const ean = variant.barcodes.find((barcode) => barcode.type === 'ean')?.value
    ?? variant.barcodes.find((barcode) => barcode.type === 'gtin')?.value;
  const url = variant.url ?? product.url;
  const image = primaryImage(product, variant);
  const productElement = root.ele('Product');

  productElement.ele('ProductId').txt(variant.id).up();
  productElement.ele('ProductName').dat(variant.title || product.title).up();
  if (variant.price) {
    productElement.ele('Price').txt(formatMoney(variant.price) ?? '').up();
  }
  productElement
    .ele('StockStatus')
    .txt(variant.availability?.available ? 'in stock' : 'out of stock')
    .up();
  if (product.brand) {
    productElement.ele('Brand').dat(product.brand).up();
  }
  productElement.ele('Msku').txt(variant.id).up();
  if (ean) {
    productElement.ele('Ean').txt(ean).up();
  }
  if (url) {
    productElement.ele('Url').txt(url).up();
  }
  if (image) {
    productElement.ele('ImageUrl').txt(image).up();
  }
  productElement
    .ele('Description')
    .dat(variant.description ?? productDescription(product))
    .up();
  productElement.ele('Condition').txt('New').up();
  productElement.ele('GroupId').txt(product.id).up();
  for (const option of variant.options) {
    productElement.ele(option.name).dat(option.value).up();
  }
}
