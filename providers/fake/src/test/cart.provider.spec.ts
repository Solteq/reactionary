import 'dotenv/config';
import { CartSchema, CategorySchema, IdentitySchema, NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { createAnonymousTestSession, getFakerTestConfiguration } from './test-utils';
import { FakeCartProvider } from '../providers/cart.provider';
import { FakeIdentityProvider } from '../providers';


const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01-with-tiers'
}

describe('Fake Cart Provider', () => {
  let provider: FakeCartProvider;
  let identityProvider: FakeIdentityProvider;
  let session: Session;

  beforeAll( () => {
    provider = new FakeCartProvider(getFakerTestConfiguration(), CartSchema, new NoOpCache());
    identityProvider = new FakeIdentityProvider(getFakerTestConfiguration(), IdentitySchema, new NoOpCache());
  });

  beforeEach( () => {
    session = createAnonymousTestSession()
  });

  describe('anonymous sessions', () => {
    it('should be able to get an empty cart', async () => {
      const cart = await provider.getById({
        cart: { key: '' },
      }, session);

      expect(cart.identifier.key).toBeFalsy();
      expect(cart.items.length).toBe(0);
      expect(cart.meta?.placeholder).toBe(true);

    });

    it('should be able to add an item to a cart', async () => {
      const cart = await provider.add({
          cart: { key: '' },
          product: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].product.key).toBe(testData.skuWithoutTiers);
      expect(cart.items[0].quantity).toBe(1);

      expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);
      expect(cart.items[0].price.totalPrice.currency).toBe(session.languageContext.currencyCode);

      expect(cart.price.grandTotal.value).toBeGreaterThan(0);
      expect(cart.price.grandTotal.currency).toBe(session.languageContext.currencyCode);

      expect(cart.price.grandTotal.value).toBe(cart.items[0].price.totalPrice.value);


      expect(cart.meta?.placeholder).toBeFalsy();

    });


    it('should be able to change quantity of an item in a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          product: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      const updatedCart = await provider.changeQuantity({
        cart: cart.identifier,
        item: cart.items[0].identifier,
        quantity: 3
      }, session);

      expect(updatedCart.identifier.key).toBe(cart.identifier.key);
      expect(updatedCart.items.length).toBe(1);
      expect(updatedCart.items[0].product.key).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(3);

      expect(updatedCart.items[0].price.totalPrice.value).toBe(cart.items[0].price.totalPrice.value * 3);
      expect(updatedCart.items[0].price.unitPrice.value).toBe(cart.items[0].price.unitPrice.value);


    });

    it('should be able to remove an item from a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          product: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      const updatedCart = await provider.remove({
        cart: cart.identifier,
        item: cart.items[0].identifier,
      }, session);
      expect(updatedCart.identifier.key).toBe(cart.identifier.key);
      expect(updatedCart.items.length).toBe(0);
    });

    /**
    it('should be able to create a cart for an anonymous user, then login and merge the cart', async () => {
    });

    it('should be able to create a cart for an anonymous user, then register and merge the cart', async () => {
    });

    it('should be able to clear the cart', async () => { });

    it('should be able to check out the cart', async () => { });
    */

  });

});
