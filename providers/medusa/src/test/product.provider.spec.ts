import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { NoOpCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { MedusaProductProvider } from '../providers/product.provider.js';
import {  getMedusaTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { MedusaClient } from '../index.js';

const testData = {
  product : {
    name: 'LV-CA31 SCART Cable',
    slug: 'lv-ca31-scart-cable-101080',
    image: 'https://images.icecat.biz/img/norm/high/101080-3513.jpg',
    sku: '4960999194479',

  },
}

describe('Medusa Product Provider', () => {
    let provider: MedusaProductProvider;
    let reqCtx: RequestContext;

    beforeEach( () => {
      reqCtx = createInitialRequestContext();
      const client = new MedusaClient(getMedusaTestConfiguration(), reqCtx);
      provider = new MedusaProductProvider(getMedusaTestConfiguration(), ProductSchema, new NoOpCache(), reqCtx, client);
    })


  it('should be able to get a product by id', async () => {
    const slugResult = await provider.getBySlug( { slug: testData.product.slug });

    expect(slugResult).toBeTruthy();


    const result = await provider.getById( { identifier: slugResult!.identifier });

    expect(result).toBeTruthy();
    expect(result.identifier.key).toBe(slugResult?.identifier.key);
    expect(result.meta.placeholder).toBe(false);
    expect(result.name).toBe(testData.product.name);

    expect(result.mainVariant).toBeDefined();
    expect(result.mainVariant.identifier.sku).toBe(testData.product.sku);
    expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
  });

  it('should be able to get a product by slug', async () => {
    const result = await provider.getBySlug( { slug: testData.product.slug });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBeTruthy();
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant).toBeDefined();
      expect(result.mainVariant.identifier.sku).toBe(testData.product.sku);
      expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
    }
  });

  it('should be able to get a product by sku', async () => {

    const slugResult = await provider.getBySlug( { slug: testData.product.slug });
    expect(slugResult).toBeTruthy();

    const result = await provider.getBySKU({
      variant: { sku: testData.product.sku }
    });

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(slugResult?.identifier.key);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant).toBeDefined();
      expect(result.mainVariant.identifier.sku).toBe(testData.product.sku);
      expect(result.mainVariant.images[0].sourceUrl).toBe(testData.product.image);
    }
  });

  it('should return null for unknown slug', async () => {
    const result = await provider.getBySlug( { slug: 'unknown-slug' });

    expect(result).toBeNull();
  });



  it('should return a placeholder product for unknown id', async () => {
    const result = await provider.getById( { identifier: { key: 'unknown-id' }} );

    expect(result).toBeTruthy();
    expect(result.meta.placeholder).toBe(true);
  });
});
