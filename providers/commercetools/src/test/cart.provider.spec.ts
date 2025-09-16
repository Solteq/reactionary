import 'dotenv/config';
import { CartSchema, CategorySchema, IdentitySchema, NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { createAnonymousTestSession, getCommercetoolsTestConfiguration } from './test-utils';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';
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
          product: {
            key: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
          },
          quantity: 1
      }, session);

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].product.key).toBe('4d28f98d-c446-446e-b59a-d9f718e5b98a');
      expect(cart.items[0].quantity).toBe(1);

    });


    it('should be able to change quantity of an item in a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          product: {
            key: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
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
      expect(updatedCart.items[0].product.key).toBe('4d28f98d-c446-446e-b59a-d9f718e5b98a');
      expect(updatedCart.items[0].quantity).toBe(3);

    });

    it('should be able to remove an item from a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          product: {
            key: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
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
