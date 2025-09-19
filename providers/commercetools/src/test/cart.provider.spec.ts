import 'dotenv/config';
import { CartSchema, CategorySchema, IdentitySchema, NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { createAnonymousTestSession, getCommercetoolsTestConfiguration } from './test-utils';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';


const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01'
}

describe('Commercetools Cart Provider', () => {
  let provider: CommercetoolsCartProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let session: Session;

  beforeAll( () => {
    provider = new CommercetoolsCartProvider(getCommercetoolsTestConfiguration(), CartSchema, new NoOpCache());
    identityProvider = new CommercetoolsIdentityProvider(getCommercetoolsTestConfiguration(), IdentitySchema, new NoOpCache());
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
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].sku.key).toBe(testData.skuWithoutTiers);
      expect(cart.items[0].quantity).toBe(1);

      expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);
      expect(cart.items[0].price.totalPrice.currency).toBe(session.languageContext.currencyCode);

      expect(cart.price.grandTotal.value).toBeGreaterThan(0);
      expect(cart.price.grandTotal.currency).toBe(session.languageContext.currencyCode);

      expect(cart.price.grandTotal.value).toBe(cart.items[0].price.totalPrice.value);


      expect(cart.meta?.placeholder).toBeFalsy();

    });

    it('can add multiple different items to a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);


      const updatedCart = await provider.add({
          cart: cart.identifier,
          sku: {
            key: testData.skuWithTiers,
          },
          quantity: 2
      }, session);

      expect(updatedCart.items.length).toBe(2);
      expect(updatedCart.items[0].sku.key).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(1);
      expect(updatedCart.items[1].sku.key).toBe(testData.skuWithTiers);
      expect(updatedCart.items[1].quantity).toBe(2);
    });

    it('should be able to change quantity of an item in a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      const updatedCart = await provider.changeQuantity({
        cart: cart.identifier,
        item: cart.items[0].identifier,
        quantity: 3
      }, session);


      expect(updatedCart.items.length).toBe(1);
      expect(updatedCart.items[0].sku.key).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(3);

      expect(updatedCart.items[0].price.totalPrice.value).toBe(cart.items[0].price.totalPrice.value * 3);
      expect(updatedCart.items[0].price.unitPrice.value).toBe(cart.items[0].price.unitPrice.value);


    });

    it('should be able to remove an item from a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      const updatedCart = await provider.remove({
        cart: cart.identifier,
        item: cart.items[0].identifier,
      }, session);

      expect(updatedCart.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, session);

      expect(cart.items.length).toBe(1);
      expect(cart.identifier.key).toBeTruthy();

      const deletedCart = await provider.deleteCart({
        cart: cart.identifier,
      }, session);

      expect(deletedCart.items.length).toBe(0);
      expect(deletedCart.identifier.key).toBe('');

      const originalCart = await provider.getById({
        cart: cart.identifier,
      }, session);

      expect(originalCart.items.length).toBe(0);
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
