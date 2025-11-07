import 'dotenv/config';
import { NoOpCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import {  getCommercetoolsTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

const testData = {
  product : {
    id: 'product_120368257',
    name: 'Philips 8720169308886 LED bulb Cool white 4000 K 4.5 W G5 E',
    image: 'https://images.icecat.biz/img/gallery/30f40d525a608a9266c72337d8efda8ed72fcb23.jpg',
    sku: '8720169308886',
    slug: 'philips-8720169308886-led-bulb-cool-white-4000-k-45-w-g5-e-120368257'
  },
}

describe('Commercetools Product Provider', () => {
    let provider: CommercetoolsProductProvider;

    beforeEach( () => {
      const reqCtx = createInitialRequestContext();
      const config = getCommercetoolsTestConfiguration();
      const client = new CommercetoolsClient(config, reqCtx);

      provider = new CommercetoolsProductProvider(config, ProductSchema, new NoOpCache(), reqCtx, client);
    })


  it('should be able to get a product by id', async () => {
    const result = await provider.getById( { id: testData.product.id });

    expect(result).toBeTruthy();
    expect(result.identifier.key).toBe(testData.product.id);
    expect(result.meta.placeholder).toBe(false);
    expect(result.name).toBe(testData.product.name);
    expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
  });

  it('should be able to get a product by slug', async () => {
    const result = await provider.getBySlug( { slug: testData.product.slug });

    expect(result).toBeTruthy();

    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
    }
  });

  it('should be able to get a product by sku', async () => {
    const result = await provider.getBySKU( { variant: { sku: testData.product.sku } });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
    }
  });

  it('should return null for unknown slug', async () => {
    const result = await provider.getBySlug( { slug: 'unknown-slug' });

    expect(result).toBeNull();
  });



  it('should return a placeholder product for unknown id', async () => {
    const result = await provider.getById( { id: 'unknown-id' });

    expect(result).toBeTruthy();
    expect(result.meta.placeholder).toBe(true);
  });
});
