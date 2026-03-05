import {
  ClientBuilder,
  createInitialRequestContext,
  NoOpCache,
  ProductSchema,
  StoreSchema,
  type RequestContext,
} from '@reactionary/core';
import type { ProductProjection, Channel } from '@commercetools/platform-sdk';
import * as z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { withCommercetoolsCapabilities } from '../core/initialize.js';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';
import { assertNotAny, assertType } from '../factories/product/utils.example.js';

const ExtendedProductSchema = ProductSchema.safeExtend({
  extendedProductValue: z.string(),
});

class ExtendedCommercetoolsProductFactory extends CommercetoolsProductFactory<
  typeof ExtendedProductSchema
> {
  constructor() {
    super(ExtendedProductSchema);
  }

  public override parseProduct(context: RequestContext, data: ProductProjection) {
    const base = super.parseProduct(context, data);
    return this.productSchema.parse({
      ...base,
      extendedProductValue: 'from-product-factory',
    });
  }
}

const ExtendedStoreSchema = StoreSchema.safeExtend({
  extendedStoreValue: z.string(),
});

class ExtendedCommercetoolsStoreFactory extends CommercetoolsStoreFactory<
  typeof ExtendedStoreSchema
> {
  constructor() {
    super(ExtendedStoreSchema);
  }

  public override parseStore(context: RequestContext, data: Channel) {
    const base = super.parseStore(context, data);
    return this.storeSchema.parse({
      ...base,
      extendedStoreValue: 'from-store-factory',
    });
  }
}

const config = {
  apiUrl: 'https://api.example.invalid',
  authUrl: 'https://auth.example.invalid',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  projectKey: 'test-project',
  scopes: [],
  paymentMethods: [],
  facetFieldsForSearch: [],
} satisfies CommercetoolsConfiguration;

function createMergedClientExample() {
  const cache = new NoOpCache();
  const context = createInitialRequestContext();

  const withProduct = withCommercetoolsCapabilities(config, {
    product: {
      enabled: true,
      factory: new ExtendedCommercetoolsProductFactory(),
    },
  });

  const withStore = withCommercetoolsCapabilities(config, {
    store: {
      enabled: true,
      factory: new ExtendedCommercetoolsStoreFactory(),
    },
  });

  const client = new ClientBuilder(context)
    .withCache(cache)
    .withCapability(withProduct)
    .withCapability(withStore)
    .build();

  client.product
    .getById({
      identifier: { key: 'p-1' },
    })
    .then((result) => {
      assertNotAny(result);
      if (result.success) {
        assertNotAny(result.value);
        assertNotAny(result.value.extendedProductValue);
        assertType<string>(result.value.extendedProductValue);
      }
    });

  client.store
    .queryByProximity({
      longitude: 10.0,
      latitude: 56.0,
      distance: 50,
      limit: 5,
    })
    .then((result) => {
      assertNotAny(result);
      if (result.success) {
        const first = result.value[0];
        assertNotAny(first);
        assertNotAny(first.extendedStoreValue);
        assertType<string>(first.extendedStoreValue);
      }
    });

  return client;
}

void createMergedClientExample;
