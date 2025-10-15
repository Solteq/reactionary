import type {
  Cache,
  Product} from '@reactionary/core';
import {
  ClientBuilder,
  NoOpCache,
  ProductSchema
} from '@reactionary/core';
import {
  FakeProductProvider,
  withFakeCapabilities,
} from '@reactionary/provider-fake';
import z from 'zod';
import { describe, expect, it } from 'vitest';

describe('basic node provider extension (models)', () => {
  const ExtendedProductModel = ProductSchema.extend({
    gtin: z.string().default('gtin-default'),
  });

  class ExtendedProductProvider extends FakeProductProvider {

    public async getByCustom(_custom: string): Promise<Product> {
      // Lets say we called somewhere...
      const data = {
        id: 'foo',
        name: 'bar'
      };

      const model = this.parseItem(data);

      return model;
    }

    protected parseItem(data: unknown): Product {
      // In the real world, call super
      // super.parseItem(data);
      // Which would start by doing
      const item = this.newModel();
    
      if (data) {
        item.name = (data as { name: string }).name;
      }
      

      return this.assert(item);
    }
  }

  function withExtendedCapabilities() {
    return (cache: Cache) => {
      const client = {
        product: new ExtendedProductProvider(
          { jitter: { mean: 0, deviation: 0 },
                  seeds: {
            category: 1,
            product: 1,
            search: 1
          }},
          ExtendedProductModel,
          cache
        ),
      };

      return client;
    };
  }

  const client = new ClientBuilder()
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
        { search: true, product: false, identity: false }
      )
    )
    .withCapability(withExtendedCapabilities())
    .withCache(new NoOpCache())
    .build();

  it('should be able to call a custom query method on the provider', async () => {
    const product = await client.product.getByCustom('1234');

    expect(product.name).toBe('bar');
  });

});
