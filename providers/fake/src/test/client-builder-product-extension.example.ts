import {
  ClientBuilder,
  NoOpCache,
  ProductSchema,
  createInitialRequestContext,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import { withFakeCapabilities } from '../core/initialize.js';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { FakeProductFactory } from '../factories/product/product.factory.js';

const assertType = <T>(_value: T) => {
  void _value;
};

type IsAny<T> = 0 extends (1 & T) ? true : false;
const assertNotAny = <T>(_value: IsAny<T> extends true ? never : T) => {
  void _value;
};

const ExtendedProductSchema = ProductSchema.safeExtend({
  extendedValue: z.string(),
});

class ExtendedFakeProductFactory extends FakeProductFactory<typeof ExtendedProductSchema> {
  constructor() {
    super(ExtendedProductSchema);
  }

  public override parseProduct(context: RequestContext, data: unknown) {
    const base = super.parseProduct(context, data);
    return this.productSchema.parse({
      ...base,
      extendedValue: 'from-fake-factory',
    });
  }
}

const config = {
  jitter: {
    mean: 0,
    deviation: 0,
  },
  seeds: {
    product: 1,
    search: 1,
    category: 1,
  },
} satisfies FakeConfiguration;

const client = new ClientBuilder(createInitialRequestContext())
  .withCache(new NoOpCache())
  .withCapability(
    withFakeCapabilities(config, {
      product: {
        enabled: true,
        factory: new ExtendedFakeProductFactory(),
      },
    }),
  )
  .build();

client.product
  .getById({
    identifier: { key: 'example-product-id' },
  })
  .then((result) => {
    assertNotAny(result);
    if (result.success) {
      assertNotAny(result.value);
      assertNotAny(result.value.extendedValue);
      assertType<string>(result.value.extendedValue);
    }
  });
