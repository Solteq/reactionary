import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { CartSchema, IdentitySchema, NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeCartProvider } from '../providers/cart.provider.js';
import { FakeIdentityProvider } from '../providers/index.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';

const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01-with-tiers'
}

describe('Fake Cart Provider', () => {
  let provider: FakeCartProvider;
  let identityProvider: FakeIdentityProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    provider = new FakeCartProvider(getFakerTestConfiguration(), new NoOpCache(), reqCtx);
    identityProvider = new FakeIdentityProvider(getFakerTestConfiguration(), new NoOpCache(), reqCtx);
  });

  describe('anonymous sessions', () => {
    it('should be able to add an item to a cart', async () => {
      const cart = await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      if (!cart.success) {
        assert.fail();
      }

      expect(cart.value.identifier.key).toBeDefined();
      expect(cart.value.items.length).toBe(1);
      expect(cart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(cart.value.items[0].quantity).toBe(1);
      expect(cart.value.items[0].price.totalPrice.value).toBeGreaterThan(0);
      expect(cart.value.items[0].price.totalPrice.currency).toBe(reqCtx.languageContext.currencyCode);
      expect(cart.value.price.grandTotal.value).toBeGreaterThan(0);
      expect(cart.value.price.grandTotal.currency).toBe(reqCtx.languageContext.currencyCode);
      expect(cart.value.price.grandTotal.value).toBe(cart.value.items[0].price.totalPrice.value);
    });

    it('should be able to change quantity of an item in a cart', async () => {
      const cart = await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });
      
      if (!cart.success) {
        assert.fail();
      }

      const updatedCart = await provider.changeQuantity({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
        quantity: 3
      });

      if (!updatedCart.success) {
        assert.fail();
      }

      expect(updatedCart.value.identifier.key).toBe(cart.value.identifier.key);
      expect(updatedCart.value.items.length).toBe(1);
      expect(updatedCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.value.items[0].quantity).toBe(3);
    });

    it('should be able to remove an item from a cart', async () => {
      const cart = await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      if (!cart.success) {
        assert.fail();
      }

      const updatedCart = await provider.remove({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
      });
    
      if (!updatedCart.success) {
        assert.fail();
      }

      expect(updatedCart.value.identifier.key).toBe(cart.value.identifier.key);
      expect(updatedCart.value.items.length).toBe(0);
    });
  });

});
