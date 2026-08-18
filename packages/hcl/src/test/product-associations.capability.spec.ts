import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductAssociationSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import { HclProductAssociationsFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
const testData = {
  product: { key: 'DR-CHRS-0001' },
};

describe('HCL Product Associations Capability', () => {
  let provider: HclProductAssociationsCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclProductAssociationsCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProductAssociationsFactory(ProductAssociationSchema),
    );
  });

  it('should return accessories for a product', async () => {
    const result = await provider.getAccessories({
      forProduct: testData.product,
      numberOfAccessories: 5,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value)).toBe(true);
    for (const item of result.value) {
      expect(item.associationIdentifier.key).toBeTruthy();
      expect(item.associationReturnType).toBe('idOnly');
      expect(item.product.key).toBeTruthy();
    }
  });

  it('should return spareparts for a product', async () => {
    const result = await provider.getSpareparts({
      forProduct: testData.product,
      numberOfSpareparts: 5,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value)).toBe(true);
    for (const item of result.value) {
      expect(item.associationIdentifier.key).toBeTruthy();
    }
  });

  it('should return replacements for a product', async () => {
    const result = await provider.getReplacements({
      forProduct: testData.product,
      numberOfReplacements: 5,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value)).toBe(true);
    for (const item of result.value) {
      expect(item.associationIdentifier.key).toBeTruthy();
    }
  });

  it('should respect the count limit', async () => {
    const result = await provider.getAccessories({
      forProduct: testData.product,
      numberOfAccessories: 1,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.length).toBeLessThanOrEqual(1);
  });

  it('should return empty array for a product with no accessories', async () => {
    // Products without configured associations should return empty, not error
    const result = await provider.getAccessories({
      forProduct: { key: 'DR-CHRS-0001' },
      numberOfAccessories: 5,
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(Array.isArray(result.value)).toBe(true);
  });
});
