import 'dotenv/config';
import { createClient } from '../utils.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { ProductSearchQueryByTermSchema, type ProductSearchQueryByTerm } from '@reactionary/core';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
};

describe('Cart Capability', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
  });

  describe('anonymous sessions', () => {
    it('should be able to get an empty cart', async () => {
      const cart = await client.cart.getById({
        cart: { key: '' },
      });

      expect(cart.identifier.key).toBeFalsy();
      expect(cart.items.length).toBe(0);
      expect(cart.meta?.placeholder).toBe(true);
    });

    it('should be able to add an item to a cart', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      expect(cart.identifier.key).toBeDefined();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(cart.items[0].quantity).toBe(1);

      expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);

      expect(cart.price.grandTotal.value).toBeGreaterThan(0);

      expect(cart.price.grandTotal.value).toBe(
        cart.items[0].price.totalPrice.value
      );

      expect(cart.meta?.placeholder).toBeFalsy();
    });

    it('can add multiple different items to a cart', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      const updatedCart = await client.cart.add({
        cart: cart.identifier,
        variant: {
          sku: testData.skuWithTiers,
        },
        quantity: 2,
      });

      expect(updatedCart.items.length).toBe(2);
      expect(updatedCart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(1);
      expect(updatedCart.items[1].variant.sku).toBe(testData.skuWithTiers);
      expect(updatedCart.items[1].quantity).toBe(2);
    });

    it('should be able to change quantity of an item in a cart', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      const updatedCart = await client.cart.changeQuantity({
        cart: cart.identifier,
        item: cart.items[0].identifier,
        quantity: 3,
      });

      expect(updatedCart.items.length).toBe(1);
      expect(updatedCart.items[0].variant.sku).toBe(testData.skuWithoutTiers);
      expect(updatedCart.items[0].quantity).toBe(3);

      expect(updatedCart.items[0].price.totalPrice.value).toBeGreaterThan(
        cart.items[0].price.totalPrice.value
      );
      expect(updatedCart.items[0].price.unitPrice.value).toBe(
        cart.items[0].price.unitPrice.value
      );
    });

    it('should be able to remove an item from a cart', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      const updatedCart = await client.cart.remove({
        cart: cart.identifier,
        item: cart.items[0].identifier,
      });

      expect(updatedCart.items.length).toBe(0);
    });

    it('should be able to delete a cart', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      expect(cart.items.length).toBe(1);
      expect(cart.identifier.key).toBeTruthy();

      const deletedCart = await client.cart.deleteCart({
        cart: cart.identifier,
      });

      expect(deletedCart.items.length).toBe(0);
      expect(deletedCart.identifier.key).toBe('');

      const originalCart = await client.cart.getById({
        cart: cart.identifier,
      });

      expect(originalCart.items.length).toBe(0);
    });

    it('can load the product information for cart items', async () => {
      const cart = await client.cart.add({
        cart: { key: '' },
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });
      expect(cart.items[0].variant).toBeDefined();

      const product = await client.product.getBySKU({
        variant: cart.items[0].variant,
      });
      expect(product).toBeTruthy();
      if (product) {
        expect(product.mainVariant.identifier.sku).toEqual(
          cart.items[0].variant.sku
        );
      }
    });

    it('should be able to add an 50 items to a cart in less than 30 seconds', async () => {
      let cart = await client.cart.getById({
        cart: { key: '' },
      });

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
      expect(searchResult.items.length).toBeGreaterThanOrEqual(8);

      for (const product of searchResult.items) {
        cart = await client.cart.add({
          cart: cart.identifier,
          variant: {
            sku: product.variants[0].variant.sku,
          },
          quantity: 1,
        });
      }

      if (cart) {
        expect(cart.identifier.key).toBeDefined();
        expect(cart.items.length).toBe(8);

        expect(cart.items[0].price.totalPrice.value).toBeGreaterThan(0);
        expect(cart.price.grandTotal.value).toBeGreaterThan(0);
        expect(cart.meta?.placeholder).toBeFalsy();
      } else {
        throw new Error('Cart is undefined');
      }
    }, 30000);
  });
});
