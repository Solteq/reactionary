import { create } from 'xmlbuilder2';
import type { ReactionaryFeedTransformer } from '../feed-transformer.js';
import type { ReactionaryFeedProduct, ReactionaryFeedVariant } from '../feed-types.js';
import {
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
    const document = create({ version: '1.0', encoding: 'UTF-8' });
    const channel = document
      .ele('rss', {
        version: '2.0',
        'xmlns:g': 'http://base.google.com/ns/1.0',
      })
      .ele('channel');
    channel.ele('title').txt('Reactionary Product Feed').up();

    for await (const product of products) {
      for (const variant of product.variants) {
        appendGoogleItem(channel, product, variant);
      }
    }

    yield `${document.end({ prettyPrint: true })}\n`;
  },
};

function appendGoogleItem(
  channel: ReturnType<ReturnType<ReturnType<typeof create>['ele']>['ele']>,
  product: ReactionaryFeedProduct,
  variant: ReactionaryFeedVariant,
): void {
  const item = channel.ele('item');
  const image = primaryImage(product, variant);
  const link = variant.url ?? product.url;
  const gtin = variant.barcodes.find((barcode) => barcode.type === 'gtin')?.value;

  item.ele('g:id').txt(variant.id).up();
  item.ele('g:item_group_id').txt(product.id).up();
  item.ele('title').txt(variant.title || product.title).up();
  item
    .ele('description')
    .txt(variant.description ?? productDescription(product))
    .up();
  if (link) {
    item.ele('link').txt(link).up();
  }
  if (image) {
    item.ele('g:image_link').txt(image).up();
  }
  item
    .ele('g:availability')
    .txt(variant.availability?.available ? 'in stock' : 'out of stock')
    .up();
  if (variant.price) {
    item.ele('g:price').txt(googleMoney(variant.price) ?? '').up();
  }
  if (product.brand) {
    item.ele('g:brand').txt(product.brand).up();
  }
  if (gtin) {
    item.ele('g:gtin').txt(gtin).up();
  }
  item.ele('g:condition').txt('new').up();
}
