
import { NoOpCache, createInitialRequestContext, unwrapValue, type Cart, type CartMutationItemAdd, type RequestContext } from '@reactionary/core';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { MedusaClient } from '../core/client.js';
import { MedusaCartProvider } from '../providers/cart.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';


const testData = {
  skuWithoutTiers: '4047443491480',
  skuWithTiers: '0819927012825'
}


describe('Medusa Cart Provider', () => {
  let provider: MedusaCartProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const client = new MedusaClient(getMedusaTestConfiguration(), reqCtx);
    provider = new MedusaCartProvider(getMedusaTestConfiguration(), new NoOpCache(), reqCtx, client);
  });

  describe('anonymous sessions', () => {
    it('should get a NotFound for an unknown identifier', async () => {
      const cart = await provider.getById({
        cart: { key: '' },
      });

      if (cart.success) {
        assert.fail();
      }
      
      expect(cart.error.type).toBe('NotFound');
    });

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


      expect(cart.value.meta.placeholder).toBeFalsy();

    });



    it('can add multiple different items to a cart', async () => {

      const cart = await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      } satisfies CartMutationItemAdd);

      if (!cart.success) {
        assert.fail();
      }

      const updatedCart = await provider.add({
          cart: cart.value.identifier,
          variant: {
            sku: testData.skuWithTiers,
          },
          quantity: 2
      });

      if (!updatedCart.success) {
        assert.fail();
      }

      expect(updatedCart.value.items.length).toBe(2);
      expect(updatedCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.value.items[0].quantity).toBe(1);
      expect(updatedCart.value.items[1].variant.sku).toBe(testData.skuWithTiers);
      expect(updatedCart.value.items[1].quantity).toBe(2);
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

      expect(updatedCart.value.items.length).toBe(1);
      expect(updatedCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.value.items[0].quantity).toBe(3);

      expect(updatedCart.value.items[0].price.totalPrice.value).toBe(cart.value.items[0].price.totalPrice.value * 3);
      expect(updatedCart.value.items[0].price.unitPrice.value).toBe(cart.value.items[0].price.unitPrice.value);
    });

    it('cannot set quantity below 1', async () => {
      const cart = unwrapValue(await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      }));
      let updatedCart: Cart;
      try {
        updatedCart = unwrapValue(await provider.changeQuantity({
          cart: cart.identifier,
          item: cart.items[0].identifier,
          quantity: 0
        }));
        expect(updatedCart).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
        return;
      }
      throw new Error('Should have thrown an error');

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

      expect(updatedCart.value.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {
      const cart = await provider.add({
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1
      });

      if (!cart.success) {
        assert.fail();
      }

      expect(cart.value.items.length).toBe(1);
      expect(cart.value.identifier.key).toBeTruthy();

      const deletedCart = await provider.deleteCart({
        cart: cart.value.identifier,
      });

      expect(deletedCart.success).toBe(true);

      const originalCart = await provider.getById({
        cart: cart.value.identifier,
      });

      if (originalCart.success) {
        assert.fail();
      }

      expect(originalCart.error.type).toBe('NotFound');
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
