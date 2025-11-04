import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { NoOpCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { MedusaProductProvider } from '../providers/product.provider.js';
import {  getMedusaTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { MedusaSKUIdentifierSchema } from '../schema/medusa.schema.js';

const testData = {
  product : {
    id: 'prod_01K86M4WSXSC20RMARN27B4WDY',
    name: 'Kosipo Ceiling/Wall Spotlight 2x',
    slug: 'kosipo-ceilingwall-spotlight-2x-100002710',
    image: 'https://images.icecat.biz/img/gallery/100002710_9607447364.jpg',
    sku: 'variant_01K86M4WTPEC57RK7TNS7609G2',

  },
}

describe('Medusa Product Provider', () => {

    let provider: MedusaProductProvider;
    let reqCtx: RequestContext;

    beforeAll( () => {
      provider = new MedusaProductProvider(getMedusaTestConfiguration(), ProductSchema, new NoOpCache());
    });

    beforeEach( () => {
      reqCtx = createInitialRequestContext()
    })


  it('should be able to get a product by id', async () => {
    const result = await provider.getById( { id: testData.product.id }, reqCtx);

    expect(result).toBeTruthy();
    expect(result.identifier.key).toBe(testData.product.id);
    expect(result.meta.placeholder).toBe(false);
    expect(result.name).toBe(testData.product.name);

    expect(result.mainVariant).toBeDefined();
    expect(result.mainVariant?.sku).toBe(testData.product.sku);
    expect(result.mainVariant.images[0]).toBe(testData.product.image);
  });

  it('should be able to get a product by slug', async () => {
    const result = await provider.getBySlug( { slug: testData.product.slug }, reqCtx);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant).toBeDefined();
      expect(result.mainVariant?.sku).toBe(testData.product.sku);
      expect(result.mainVariant.images[0]).toBe(testData.product.image);
    }
  });

  it('should be able to get a product by sku', async () => {
    const result = await provider.getBySKU({
      variant: MedusaSKUIdentifierSchema.parse({ key: testData.product.sku, productIdentifier: { key: testData.product.id } })
    },
    reqCtx);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.mainVariant).toBeDefined();
      expect(result.mainVariant?.sku).toBe(testData.product.sku);
      expect(result.mainVariant.images[0]).toBe(testData.product.image);
    }
  });

  it('should return null for unknown slug', async () => {
    const result = await provider.getBySlug( { slug: 'unknown-slug' }, reqCtx);

    expect(result).toBeNull();
  });



  it('should return a placeholder product for unknown id', async () => {
    const result = await provider.getById( { id: 'unknown-id' }, reqCtx);

    expect(result).toBeTruthy();
    expect(result.meta.placeholder).toBe(true);
  });
});
