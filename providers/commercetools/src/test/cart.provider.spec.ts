import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { CartSchema, IdentitySchema, NoOpCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils';
import { CommercetoolsCartProvider } from '../providers/cart.provider';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider';
import { CommercetoolsProductProvider } from '../providers/product.provider';


const testData = {
  skuWithoutTiers: 'SGB-01',
  skuWithTiers: 'GMCT-01'
}

describe('Commercetools Cart Provider', () => {
  let provider: CommercetoolsCartProvider;
  let productProvider: CommercetoolsProductProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new CommercetoolsCartProvider(getCommercetoolsTestConfiguration(), CartSchema, new NoOpCache());
    identityProvider = new CommercetoolsIdentityProvider(getCommercetoolsTestConfiguration(), IdentitySchema, new NoOpCache());
    productProvider = new CommercetoolsProductProvider(getCommercetoolsTestConfiguration(), ProductSchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  });

  describe('anonymous sessions', () => {
    it('should be able to get an empty cart', async () => {
      const cart = await provider.getById({
        cart: { key: '' },
      }, reqCtx);

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
      }, reqCtx);

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].sku.key).toBe(testData.skuWithoutTiers);
      expect(cart.items[0].quantity).toBe(1);

      expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);
      expect(cart.items[0].price.totalPrice.currency).toBe(reqCtx.languageContext.currencyCode);

      expect(cart.price.grandTotal.value).toBeGreaterThan(0);
      expect(cart.price.grandTotal.currency).toBe(reqCtx.languageContext.currencyCode);

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
      }, reqCtx);


      const updatedCart = await provider.add({
          cart: cart.identifier,
          sku: {
            key: testData.skuWithTiers,
          },
          quantity: 2
      }, reqCtx);

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
      }, reqCtx);

      const updatedCart = await provider.changeQuantity({
        cart: cart.identifier,
        item: cart.items[0].identifier,
        quantity: 3
      }, reqCtx);


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
      }, reqCtx);

      const updatedCart = await provider.remove({
        cart: cart.identifier,
        item: cart.items[0].identifier,
      }, reqCtx);

      expect(updatedCart.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, reqCtx);

      expect(cart.items.length).toBe(1);
      expect(cart.identifier.key).toBeTruthy();

      const deletedCart = await provider.deleteCart({
        cart: cart.identifier,
      }, reqCtx);

      expect(deletedCart.items.length).toBe(0);
      expect(deletedCart.identifier.key).toBe('');

      const originalCart = await provider.getById({
        cart: cart.identifier,
      }, reqCtx);

      expect(originalCart.items.length).toBe(0);
    });

    it('can load the product information for cart items', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, reqCtx);
      expect(cart.items[0].product).toBeUndefined();

      const product = await productProvider.getBySKU( { sku: cart.items[0].sku }, reqCtx);
      expect(product).toBeTruthy();
      if (product) {
        expect(product.skus.some(s => s.identifier.key === cart.items[0].sku.key)).toBe(true);
      }
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
