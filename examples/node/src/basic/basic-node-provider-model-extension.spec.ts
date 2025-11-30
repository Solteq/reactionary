import type {
  Cache,
  ProductQueryById,
  ProductQueryBySlug,
  RequestContext} from '@reactionary/core';
import {
  ClientBuilder,
  NoOpCache,
  ProductSchema
} from '@reactionary/core';
import {
  FakeProductProvider,
  withFakeCapabilities,
} from '@reactionary/provider-fake';
import { createInitialRequestContext } from '@reactionary/core'
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

describe('basic node provider extension (models)', () => {
  const reqCtx = createInitialRequestContext();

  const ExtendedProductModel = ProductSchema.extend({
    gtin: z.string().default('gtin-default'),
  });
  type ExtendedProduct = z.infer<typeof ExtendedProductModel>;

  class ExtendedProductProvider extends FakeProductProvider {
    protected override parseSingle(body: string): ExtendedProduct {
      const result = {
        ...super.parseSingle(body),
        gtin: 'gtin-1234'
      } satisfies ExtendedProduct;

      return result;
    }
  }

  function withExtendedCapabilities() {
    return (cache: Cache, context: RequestContext) => {
      const client = {
        product: new ExtendedProductProvider(
          { jitter: { mean: 0, deviation: 0 },
          seeds: {
            category: 1,
            product: 1,
            search: 1
          } },
          cache,
          context
        ),
      };

      return client;
    };
  }

  const client = new ClientBuilder(reqCtx)
    .withCapability(
      withFakeCapabilities(
        {
          jitter: {
            mean: 0,
            deviation: 0,
          },
          seeds: {
            category: 1,
            product: 1,
            search: 1
          }
        },
        { productSearch: true, product: false, identity: false }
      )
    )
    .withCapability(withExtendedCapabilities())
    .withCache(new NoOpCache())
    .build();

  it('should get the enabled set of capabilities across providers', async () => {
    expect(client.product).toBeDefined();
    expect(client.productSearch).toBeDefined();
  });

  it('should be able to call the regular methods and get the default value', async () => {
    const product = await client.product.getBySlug(
      {
        slug: '1234',
      }
    );

    expect(product).toBeDefined();
    // FIXME: expect(product.gtin).toBe('gtin-1234');
  });

  it('should be able to get serialized value from the extended provider', async () => {
    const product = await client.product.getById(
      {
        identifier: { key: '1234' },
      }
    );

    expect(product).toBeDefined();
    // FIXME: expect(product.gtin).toBe('gtin-1234');
  });
});
