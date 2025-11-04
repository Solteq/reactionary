
import { describe, it, expect, beforeEach,  beforeAll } from 'vitest';
import { MedusaCartProvider } from '../providers/cart.provider.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaCartIdentifierSchema } from '../schema/medusa.schema.js';
import { CartSchema, NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultItemSchema, ProductSearchResultSchema, createInitialRequestContext, type Cart, type RequestContext } from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaSearchProvider } from '../providers/product-search.provider.js';


const testData = {
  skuWithoutTiers: 'variant_01K86M4X3S2PJDYXAWM9WG2RA9',
  skuWithTiers: 'variant_01K86M50HBJ27AQZC5YH3TRB68'
}


describe('Medusa Cart Provider - Large Scenarios', () => {

  let provider: MedusaCartProvider;
  let searchProvider: MedusaSearchProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new MedusaCartProvider(getMedusaTestConfiguration(), CartSchema, new NoOpCache());
    searchProvider = new MedusaSearchProvider(getMedusaTestConfiguration(), ProductSearchResultItemSchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  });

  describe('large carts', () => {


    it('should be able to add an 50 items to a cart in less than 30 seconds', async () => {
      let cart = await provider.getById({
        cart: { key: '' },
      }, reqCtx);

      const searchResult = await searchProvider.queryByTerm( ProductSearchQueryByTermSchema.parse({ search: {
        term: 'phil',
        page: 1,
        pageSize: 50,
        facets: [],
      } }), reqCtx);
      expect(searchResult.items.length).toBeGreaterThanOrEqual(50);


      for(const product of searchResult.items) {
        cart = await provider.add({
            cart:  cart.identifier,
            sku: {
              sku: product.identifier.key as string,
            },
            quantity: 1
        }, reqCtx);
      }

      if (cart) {
        expect(cart.identifier.key).toBeDefined();
        expect(cart.items.length).toBe(50);

        expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);
        expect(cart.items[0].price.totalPrice.currency).toBe(reqCtx.languageContext.currencyCode);

        expect(cart.price.grandTotal.value).toBeGreaterThan(0);
        expect(cart.price.grandTotal.currency).toBe(reqCtx.languageContext.currencyCode);

        expect(cart.meta?.placeholder).toBeFalsy();
      } else {
        throw new Error('Cart is undefined');
      }

    }, 30000);


  });


});
