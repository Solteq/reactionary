import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { ProductSearchQueryByTermSchema, type ProductSearchQueryByTerm } from '@reactionary/core';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
};

describe.each([ PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])('Cart Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  describe('anonymous sessions', () => {
    it('should get a NotFound for an unknown cart ID', async () => {
      const cart = await client.cart.getById({
        cart: { key: '' },
      });

      if (cart.success) {
        assert.fail();
      }

      expect(cart.error.type).toBe('NotFound');
    });

    it('should be able to add an item to a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }

      expect(cart.value.identifier.key).toBeDefined();
      expect(cart.value.items.length).toBe(1);
      expect(cart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(cart.value.items[0].quantity).toBe(1);

      expect(cart.value.items[0].price.totalPrice.value).toBeGreaterThan(0);

      expect(cart.value.price.grandTotal.value).toBeGreaterThan(0);

      expect(cart.value.price.grandTotal.value).toBe(
        cart.value.items[0].price.totalPrice.value
      );
    });

    it('can add multiple different items to a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });
      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }

      const updatedCart = await client.cart.add({
        cart: cart.value.identifier,
        variant: {
          sku: testData.skuWithTiers,
        },
        quantity: 2,
      });

      if (!updatedCart.success) {
        assert.fail(JSON.stringify(updatedCart.error) );
      }

      expect(updatedCart.value.items.length).toBe(2);
      expect(updatedCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.value.items[0].quantity).toBe(1);
      expect(updatedCart.value.items[1].variant.sku).toBe(testData.skuWithTiers);
      expect(updatedCart.value.items[1].quantity).toBe(2);
    });

    it('should be able to change quantity of an item in a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail (JSON.stringify(cart.error) );
      }

      const updatedCart = await client.cart.changeQuantity({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
        quantity: 3,
      });

      if (!updatedCart.success) {
        assert.fail(JSON.stringify(updatedCart.error));
      }

      expect(updatedCart.value.items.length).toBe(1);
      expect(updatedCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.value.items[0].quantity).toBe(3);
      expect(updatedCart.value.items[0].price.totalPrice.value).toBeGreaterThan(
        cart.value.items[0].price.totalPrice.value
      );
      expect(updatedCart.value.items[0].price.unitPrice.value).toBe(
        cart.value.items[0].price.unitPrice.value
      );
    });

    it('should be able to remove an item from a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }

      const updatedCart = await client.cart.remove({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
      });

      if (!updatedCart.success) {
        assert.fail(JSON.stringify(updatedCart.error));
      }

      expect(updatedCart.value.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {


      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error)  );
      }

      expect(cart.value.items.length).toBe(1);
      expect(cart.value.identifier.key).toBeTruthy();

      const deleteCartResponse = await client.cart.deleteCart({
        cart: cart.value.identifier,
      });

      if (!deleteCartResponse.success) {
        assert.fail(JSON.stringify(deleteCartResponse.error));
      }


      const originalCart = await client.cart.getById({
        cart: cart.value.identifier,
      });


      if (provider === PrimaryProvider.MEDUSA) {
        // medusa can't delete a cart, so we just empty it.
        if (!originalCart.success) {
          assert.fail(JSON.stringify(originalCart.error));
        }

        expect(originalCart.value.items.length).toBe(0);
        return;
      }

      if (originalCart.success) {
        assert.fail(JSON.stringify(originalCart.value));
      }
      expect(originalCart.error.type).toBe('NotFound');
    });

    it('can load the product information for cart items', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }

      expect(cart.value.items[0].variant).toBeDefined();

      const product = await client.product.getBySKU({
        variant: cart.value.items[0].variant,
      });

      if (!product.success) {
        assert.fail(JSON.stringify(product.error));
      }

      expect(product).toBeTruthy();
      if (product) {
        expect(product.value.mainVariant.identifier.sku).toEqual(
          cart.value.items[0].variant.sku
        );
      }
    });

    it('can apply a coupon code to a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }
      expect(cart.value.price.totalDiscount.value).toBe(0);

      const updatedCart = await client.cart.applyCouponCode({
        cart: cart.value.identifier,
        couponCode: 'TESTCODE1',
      });

      if (!updatedCart.success) {
        assert.fail(JSON.stringify(updatedCart.error));
      }

      expect(updatedCart.value.price.grandTotal.value).toBeLessThan(cart.value.price.grandTotal.value);
      expect(updatedCart.value.price.totalDiscount.value).toBeGreaterThan(0);

      expect(updatedCart.value.appliedPromotions.find(promo => promo.code === 'TESTCODE1' && promo.isCouponCode === true)).toBeTruthy();

    });

    it('can remove a coupon code from a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }
      const updatedCart = await client.cart.applyCouponCode({
        cart: cart.value.identifier,
        couponCode: 'TESTCODE1',
      });

      if (!updatedCart.success) {
        assert.fail(JSON.stringify(updatedCart.error));
      }

      expect(updatedCart.value.price.grandTotal.value).toBeLessThan(cart.value.price.grandTotal.value);

      const removedCouponCart = await client.cart.removeCouponCode({
        cart: cart.value.identifier,
        couponCode: 'TESTCODE1',
      });

      if (!removedCouponCart.success) {
        assert.fail(JSON.stringify(removedCouponCart.error));
      }

      expect(removedCouponCart.value.price.grandTotal.value).toBeGreaterThan(updatedCart.value.price.grandTotal.value);
      expect(removedCouponCart.value.price.grandTotal.value).toBe(cart.value.price.grandTotal.value);
    });


    it('should be able to add an 50 items to a cart in less than 30 seconds', async () => {
      const searchResult = await client.productSearch.queryByTerm(
        ProductSearchQueryByTermSchema.parse({
          search: {
            term: 'cable',
            paginationOptions: {
              pageNumber: 1,
              pageSize: 8,
            },
            filters: [],
            facets: [],
          },
        } satisfies ProductSearchQueryByTerm)
      );

      if (!searchResult.success) {
        assert.fail(JSON.stringify(searchResult.error)  );
      }

      let cartIdentifier = undefined;
      let cart = undefined;
      expect(searchResult.value.items.length).toBeGreaterThanOrEqual(8);

      for (const product of searchResult.value.items) {
        const updated = await client.cart.add({
          cart: cartIdentifier,
          variant: {
            sku: product.variants[0].variant.sku,
          },
          quantity: 1,
        });

        if (!updated.success) {
          assert.fail();
        }

        cart = updated;
        cartIdentifier = updated.value.identifier;
      }

      if (cart) {
        expect(cart.value.identifier.key).toBeDefined();
        expect(cart.value.items.length).toBe(8);

        expect(cart.value.items[0].price.totalPrice.value).toBeGreaterThan(0);
        expect(cart.value.price.grandTotal.value).toBeGreaterThan(0);
      } else {
        throw new Error('Cart is undefined');
      }
    }, 30000);
  });
});
