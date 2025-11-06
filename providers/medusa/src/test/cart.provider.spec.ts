
import { CartSchema, NoOpCache, createInitialRequestContext, type Cart, type RequestContext } from '@reactionary/core';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MedusaCartProvider } from '../providers/cart.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';


const testData = {
  skuWithoutTiers: '8719514435254',
  skuWithTiers: '8719514435377'
}


describe('Medusa Cart Provider', () => {
  let provider: MedusaCartProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    provider = new MedusaCartProvider(getMedusaTestConfiguration(), CartSchema, new NoOpCache(), reqCtx);
  });

  describe('anonymous sessions', () => {
    it('should be able to get an empty cart', async () => {
      const cart = await provider.getById({
        cart: { key: '' },
      });

      expect(cart.identifier.key).toBeFalsy();
      expect(cart.items.length).toBe(0);
      expect(cart.meta?.placeholder).toBe(true);

    });

    it('should be able to add an item to a cart', async () => {
      const cart = await provider.add({
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
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
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });


      const updatedCart = await provider.add({
          cart: cart.identifier,
          variant: {
            sku: testData.skuWithTiers,
          },
          quantity: 2
      });

      expect(updatedCart.items.length).toBe(2);
      expect(updatedCart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(1);
      expect(updatedCart.items[1].variant.sku).toBe(testData.skuWithTiers);
      expect(updatedCart.items[1].quantity).toBe(2);
    });

    it('should be able to change quantity of an item in a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      const updatedCart = await provider.changeQuantity({
        cart: cart.identifier,
        item: cart.items[0].identifier,
        quantity: 3
      });


      expect(updatedCart.items.length).toBe(1);
      expect(updatedCart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(3);

      expect(updatedCart.items[0].price.totalPrice.value).toBe(cart.items[0].price.totalPrice.value * 3);
      expect(updatedCart.items[0].price.unitPrice.value).toBe(cart.items[0].price.unitPrice.value);

    });

    it('cannot set quantity below 1', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });
      let updatedCart: Cart;
      try {
        updatedCart = await provider.changeQuantity({
          cart: cart.identifier,
          item: cart.items[0].identifier,
          quantity: 0
        });
        expect(updatedCart).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
        return;
      }
      throw new Error('Should have thrown an error');

    });


    it('should be able to remove an item from a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      const updatedCart = await provider.remove({
        cart: cart.identifier,
        item: cart.items[0].identifier,
      });

      expect(updatedCart.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      expect(cart.items.length).toBe(1);
      expect(cart.identifier.key).toBeTruthy();

      const deletedCart = await provider.deleteCart({
        cart: cart.identifier,
      });

      expect(deletedCart.items.length).toBe(0);
      expect(deletedCart.identifier.key).toBe('');

      const originalCart = await provider.getById({
        cart: cart.identifier,
      });

      expect(originalCart.items.length).toBe(0);
    });
/*
    it('can load the product information for cart items', async () => {

      const cart = await provider.add({
          cart: { key: '' },
          sku: {
            key: testData.skuWithoutTiers,
          },
          quantity: 1
      }, reqCtx);
      expect(cart.items[0].sku).toBeDefined();

      const product = await productProvider.getBySKU( { sku: cart.items[0].sku }, reqCtx);
      expect(product).toBeTruthy();
      if (product) {
        expect(product.skus.some(s => s.identifier.key === cart.items[0].sku.key)).toBe(true);
      }
    }); */
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
