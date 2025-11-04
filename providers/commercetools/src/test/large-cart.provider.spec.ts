import 'dotenv/config';

import { CartSchema, NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultItemSchema, createInitialRequestContext, type ProductSearchQueryByTerm, type RequestContext } from '@reactionary/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CommercetoolsSearchProvider } from '../index.js';
import { CommercetoolsCartProvider } from '../providers/cart.provider.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';


const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01'
}

describe('Commercetools Cart Provider - Large Scenarios', () => {

  let provider: CommercetoolsCartProvider;
  let searchProvider: CommercetoolsSearchProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new CommercetoolsCartProvider(getCommercetoolsTestConfiguration(), CartSchema, new NoOpCache());
    searchProvider = new CommercetoolsSearchProvider(getCommercetoolsTestConfiguration(), ProductSearchResultItemSchema, new NoOpCache());
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
        term: 'bowl',
        paginationOptions: {
          pageNumber: 1,
          pageSize: 8,
        },
        filters: [],
        facets: [],
      }
      } satisfies ProductSearchQueryByTerm ), reqCtx);
      expect(searchResult.items.length).toBeGreaterThanOrEqual(8);


      for(const product of searchResult.items) {
        cart = await provider.add({
            cart:  cart.identifier,
            variant: {
              sku: product.variants[0].variant.sku,
            },
            quantity: 1
        }, reqCtx);
      }

      if (cart) {
        expect(cart.identifier.key).toBeDefined();
        expect(cart.items.length).toBe(8);

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
