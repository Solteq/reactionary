import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { ProductSearchQueryByTermSchema, type ProductSearchQueryByTerm } from '@reactionary/core';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
};

describe.each([PrimaryProvider.COMMERCETOOLS])('Cart Capability - %s', (provider) => {
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
        assert.fail();
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

      expect(cart.value.meta?.placeholder).toBeFalsy();
    });

    it('can add multiple different items to a cart', async () => {
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });
      
      if (!cart.success) {
        assert.fail();
      }

      const updatedCart = await client.cart.add({
        cart: cart.value.identifier,
        variant: {
          sku: testData.skuWithTiers,
        },
        quantity: 2,
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
      const cart = await client.cart.add({
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!cart.success) {
        assert.fail();
      }

      const updatedCart = await client.cart.changeQuantity({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
        quantity: 3,
      });

      if (!updatedCart.success) {
        assert.fail();
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
        assert.fail();
      }

      const updatedCart = await client.cart.remove({
        cart: cart.value.identifier,
        item: cart.value.items[0].identifier,
      });

      if (!updatedCart.success) {
        assert.fail();
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
        assert.fail();
      }

      expect(cart.value.items.length).toBe(1);
      expect(cart.value.identifier.key).toBeTruthy();

      await client.cart.deleteCart({
        cart: cart.value.identifier,
      });

      const originalCart = await client.cart.getById({
        cart: cart.value.identifier,
      });

      if (originalCart.success) {
        assert.fail();
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
        assert.fail();
      }

      expect(cart.value.items[0].variant).toBeDefined();

      const product = await client.product.getBySKU({
        variant: cart.value.items[0].variant,
      });

      if (!product.success) {
        assert.fail();
      }

      expect(product).toBeTruthy();
      if (product) {
        expect(product.value.mainVariant.identifier.sku).toEqual(
          cart.value.items[0].variant.sku
        );
      }
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
        assert.fail();
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
        expect(cart.value.meta?.placeholder).toBeFalsy();
      } else {
        throw new Error('Cart is undefined');
      }
    }, 30000);
  });
});
