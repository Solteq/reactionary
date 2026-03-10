import {
  CartIdentifierSchema,
  CartSchema,
  NoOpCache,
  ProductSearchResultSchema,
  ProductSearchQueryByTermSchema,
  ProductSearchResultItemSchema,
  createInitialRequestContext,
  type ProductSearchQueryByTerm,
  type RequestContext,
} from '@reactionary/core';
import { assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MedusaCartCapability } from '../capabilities/cart.capability.js';
import { MedusaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaAPI } from '../core/client.js';
import { MedusaCartFactory } from '../factories/cart/cart.factory.js';
import { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';

/**
const testData = {
  skuWithoutTiers: '8719514435254',
  skuWithTiers: '8719514435377'
}
*/

describe('Medusa Cart Provider - Large Scenarios', () => {
  let provider: MedusaCartCapability;
  let searchProvider: MedusaProductSearchCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const client = new MedusaAPI(getMedusaTestConfiguration(), reqCtx);
    provider = new MedusaCartCapability(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      client,
      new MedusaCartFactory(CartSchema, CartIdentifierSchema),
    );
    searchProvider = new MedusaProductSearchCapability(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      client,
      new MedusaProductSearchFactory(ProductSearchResultSchema),
    );
  });

  describe('large carts', () => {
    it('should be able to add an 50 items to a cart in less than 30 seconds', async () => {
      const searchResult = await searchProvider.queryByTerm(
        ProductSearchQueryByTermSchema.parse({
          search: {
            term: 'phil',
            paginationOptions: {
              pageNumber: 1,
              pageSize: 50,
            },
            filters: [],
            facets: [],
          },
        } satisfies ProductSearchQueryByTerm)
      );

      if (!searchResult.success) {
        assert.fail();
      }

      expect(searchResult.value.items.length).toBeGreaterThanOrEqual(50);

      let cartIdentifier = undefined;
      let cart;
      for (const product of searchResult.value.items) {
        cart = await provider.add({
          cart: cartIdentifier,
          variant: {
            sku: product.variants[0].variant.sku,
          },
          quantity: 1,
        });

        if (!cart.success) {
          assert.fail();
        }

        cartIdentifier = cart.value.identifier;
      }

      if (!cart) {
        assert.fail();
      }

      expect(cart.value.identifier.key).toBeDefined();
      expect(cart.value.items.length).toBe(50);

      expect(cart.value.items[0].price.totalPrice.value).toBeGreaterThan(0);
      expect(cart.value.items[0].price.totalPrice.currency).toBe(
        reqCtx.languageContext.currencyCode
      );

      expect(cart.value.price.grandTotal.value).toBeGreaterThan(0);
      expect(cart.value.price.grandTotal.currency).toBe(
        reqCtx.languageContext.currencyCode
      );
    }, 30000);
  });
});
