import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { ProductSearchQueryByTermSchema, type Cart, type CartIdentifier, type ProductSearchQueryByTerm } from '@reactionary/core';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
};

describe.each([PrimaryProvider.COMMERCETOOLS,  PrimaryProvider.MEDUSA])('Cart Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    client = createClient(provider);
  });

  it('can create a cart and get it by ID', async () => {
    const cart = await client.cart.createCart({});

    if (!cart.success) {
      assert.fail(JSON.stringify(cart.error));
    }

    const sameCart = await client.cart.getById({
      cart: cart.value.identifier,
    });

    if (!sameCart.success) {
      assert.fail(JSON.stringify(sameCart.error));
    }

    expect(cart.value.identifier.key).toBe(sameCart.value.identifier.key);
  });

  describe('anonymous sessions', () => {
    let cartIdentifier: CartIdentifier | undefined;

    beforeEach(async () => {
      const cleanCart = await client.cart.createCart({});

      if (!cleanCart.success) {
        assert.fail(JSON.stringify(cleanCart.error));
      }
      cartIdentifier = cleanCart.value.identifier;
    });

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
        cart: cartIdentifier,
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
    },50000);

    it('can add multiple different items to a cart', async () => {
      const cart = await client.cart.add({
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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
        cart: cartIdentifier,
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

    it('should be able to have multiple carts open at the same time', async () => {
      const firstCart = await client.cart.createCart({ name: 'First Cart' });

      if (!firstCart.success) {
        assert.fail(JSON.stringify(firstCart.error));
      }
      const secondCart = await client.cart.createCart({ name: 'Second Cart' });

      if (!secondCart.success) {
        assert.fail(JSON.stringify(secondCart.error));
      }

      expect(firstCart.value.identifier.key).toBeDefined();
      expect(secondCart.value.identifier.key).toBeDefined();
      expect(firstCart.value.identifier.key).not.toEqual(secondCart.value.identifier.key);
    });

    it('can list all b2c carts for a user', async () => {
      const extraCart = await client.cart.createCart({ name: 'First Cart' });

      if (!extraCart.success) {
        assert.fail(JSON.stringify(extraCart.error));
      }
      const addToCartResult = await client.cart.add({
        cart: extraCart.value.identifier,
        variant: {
          sku: testData.skuWithoutTiers,
        },
        quantity: 1,
      });

      if (!addToCartResult.success) {
        assert.fail(JSON.stringify(addToCartResult.error));
      }

      const listResult = await client.cart.listCarts({
        search: {
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
        }
      });

      if (!listResult.success) {
        assert.fail(JSON.stringify(listResult.error));
      }

      expect(listResult.value.items.length).toBe(2);

      const extraCartInList = listResult.value.items.find(cart => cart.identifier.key === extraCart.value.identifier.key);
      if (!extraCartInList) {
        assert.fail('Extra cart not found in list');
      }
      expect(extraCartInList).toBeTruthy();
      expect(extraCartInList.name).toBe('First Cart');
      expect(extraCartInList.company).toBeUndefined();
      expect(extraCartInList.user).toBeTruthy();
      expect(extraCartInList.identifier.key).toBe(extraCart.value.identifier.key);
      expect(extraCartInList.numItems).toBe(1);

      const originalCartInList = listResult.value.items.find(cart => cart.identifier.key === cartIdentifier?.key);
      if (!originalCartInList) {
        assert.fail('Original cart not found in list');
      }
      expect(originalCartInList).toBeTruthy();
      expect(originalCartInList.name).toBe('');
      expect(originalCartInList.company).toBeUndefined();
      expect(originalCartInList.user).toBeTruthy();
      expect(originalCartInList.identifier.key).toBe(cartIdentifier?.key);
      expect(originalCartInList.numItems).toBe(0);

    });

    it ('can paginate the list of carts', async () => {
      for (let i = 0; i < 5; i++) {
        const extraCart = await client.cart.createCart({ name: `Cart ${i}` });

        if (!extraCart.success) {
          assert.fail(JSON.stringify(extraCart.error));
        }
      }

      const listResult = await client.cart.listCarts({
        search: {
          paginationOptions: {
            pageNumber: 2,
            pageSize: 2,
          },
        }
      });
      if (!listResult.success) {
        assert.fail(JSON.stringify(listResult.error));
      }

      expect(listResult.value.items.length).toBe(2);
      expect(listResult.value.pageNumber).toBe(2);
      expect(listResult.value.pageSize).toBe(2);
      expect(listResult.value.totalCount).toBeGreaterThanOrEqual(6);
      expect(listResult.value.totalPages).toBeGreaterThanOrEqual(3);
    });

    it('can rename a cart', async () => {
      const cart = await client.cart.createCart({ name: 'Old Name' });

      if (!cart.success) {
        assert.fail(JSON.stringify(cart.error));
      }

      const renamedCart = await client.cart.renameCart({
        cart: cart.value.identifier,
        newName: 'New Name',
      });

      if (!renamedCart.success) {
        assert.fail(JSON.stringify(renamedCart.error));
      }

      expect(renamedCart.value.name).toBe('New Name');
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
          assert.fail(JSON.stringify(updated.error) );
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


  describe('logged in sessions', () => {
     describe('cart ownership on login to existing user', () => {

      it('will carry over the cart from an anonymous session', async () => {
        const userName = `testuser${Date.now()}@example.com`;

        const identity = await client.identity.register({
          username: userName,
          password: 'password'
        });

        if (!identity.success) {
          assert.fail(JSON.stringify(identity.error));
        }
        if (identity.value.type !== 'Registered') {
          assert.fail('Identity is not registered');
        }
        const loggedInId = identity.value.id;

        const logoutResult = await client.identity.logout({});
        if (!logoutResult.success) {
          assert.fail(JSON.stringify(logoutResult.error));
        }

        if (logoutResult.value.type !== 'Anonymous') {
          assert.fail('Identity is not anonymous after logout');
        }


        const cart = await client.cart.createCart({
          name: 'Cart to Carry Over',
        });
        if (!cart.success) {
          assert.fail(JSON.stringify(cart.error));
        }

        const updatedCart = await client.cart.add({
          cart: cart.value.identifier,
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1,
        });

        if (!updatedCart.success) {
          assert.fail(JSON.stringify(updatedCart.error));
        }

        const guestCart = updatedCart.value;

        const myAnon = await client.identity.getSelf({});
        if (!myAnon.success) {
          assert.fail(JSON.stringify(myAnon.error));
        }
        expect(myAnon.value.type).toBe('Guest');
        if (myAnon.value.type !== 'Guest') {
          assert.fail('Identity is not guest');
        }
        if (myAnon.value.id.userId === loggedInId.userId) {
          assert.fail('Guest user ID should not be the same as logged in user ID');
        }

        // log back in
        const loginResult = await client.identity.login({ username: userName,password:  'password'});
        if (!loginResult.success) {
          assert.fail(JSON.stringify(loginResult.error));
        }
        if (loginResult.value.type !== 'Registered') {
          assert.fail('Identity is not registered after login');
        }
        expect(loginResult.value.id.userId).toBe(loggedInId.userId);

        const sameCart = await client.cart.getById({
          cart: guestCart.identifier,
        });

        if (!sameCart.success) {
          assert.fail(JSON.stringify(sameCart.error));
        }
        expect(sameCart.value.identifier.key).toBe(guestCart.identifier.key);
        expect(sameCart.value.items.length).toBe(1);
        expect(sameCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
        expect(sameCart.value.items[0].quantity).toBe(1);
        expect(sameCart.value.name).toBe('Cart to Carry Over');

        // and i can still add to it
        const updatedCart2 = await client.cart.add({
          cart: sameCart.value.identifier,
          variant: {
            sku: testData.skuWithTiers,
          },
          quantity: 2,
        });

        if (!updatedCart2.success) {
          assert.fail(JSON.stringify(updatedCart2.error));
        }
      }, 15000);

     });

    describe('cart ownership on signup', () => {

      it('will carry over the cart from an anonymous session to a new registration in session', async () => {
        const cart = await client.cart.createCart({
          name: 'Cart to Carry Over',
        });
        if (!cart.success) {
          assert.fail(JSON.stringify(cart.error));
        }

        const updatedCart = await client.cart.add({
          cart: cart.value.identifier,
          variant: {
            sku: testData.skuWithoutTiers,
          },
          quantity: 1,
        });
        if (!updatedCart.success) {
          assert.fail(JSON.stringify(updatedCart.error));
        }

        const guestCart = updatedCart.value;
        let guestUserId;
        let guestIdentity;

        const myAnon = await client.identity.getSelf({});
        if (!myAnon.success) {
          assert.fail(JSON.stringify(myAnon.error));
        }
        expect(myAnon.value.type).toBe('Guest');

        if (myAnon.value.type === 'Guest') {
          guestIdentity = myAnon.value;
          guestUserId = myAnon.value.id.userId;
        }

        expect(guestUserId).toBeTruthy();


        const identity = await client.identity.register({
          username: `testuser${Date.now()}@example.com`,
          password: 'password'
        });

        if (!identity.success) {
          assert.fail(JSON.stringify(identity.error));
        }
        if (identity.value.type !== 'Registered') {
          assert.fail('Identity is not registered');
        }
        expect(identity.value.id.userId).not.toBe(guestUserId);

        const sameCart = await client.cart.getById({
          cart: guestCart.identifier,
        });

        if (!sameCart.success) {
          assert.fail(JSON.stringify(sameCart.error));
        }
        expect(sameCart.value.identifier.key).toBe(guestCart.identifier.key);
        expect(sameCart.value.items.length).toBe(1);
        expect(sameCart.value.items[0].variant.sku).toBe(testData.skuWithoutTiers);
        expect(sameCart.value.items[0].quantity).toBe(1);
        expect(sameCart.value.name).toBe('Cart to Carry Over');

        // and i can still add to it
        const updatedCart2 = await client.cart.add({
          cart: sameCart.value.identifier,
          variant: {
            sku: testData.skuWithTiers,
          },
          quantity: 2,
        });

        if (!updatedCart2.success) {
          assert.fail(JSON.stringify(updatedCart2.error));
        }

        // and if i log out, i lose access to it
        const logoutResult = await client.identity.logout({});
        if (!logoutResult.success) {
          assert.fail(JSON.stringify(logoutResult.error));
        }

        const cartAfterLogout = await client.cart.getById({
          cart: guestCart.identifier,
        });

        if (cartAfterLogout.success) {
          // for medusa..... this isn't strictly true..yet.
          assert.fail(JSON.stringify(cartAfterLogout.value));
        }

        expect(cartAfterLogout.error.type).toBe('NotFound');
      }, 15000);
    });



  });
});
