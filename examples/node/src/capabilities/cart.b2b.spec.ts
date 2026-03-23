import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { ProductSearchQueryByTermSchema, type Cart, type CartIdentifier, type Company, type CompanyIdentifier, type ProductSearchQueryByTerm } from '@reactionary/core';

const testData = {
  skuWithoutTiers: '0766623301831',
  skuWithTiers: '0766623360203',
  requestTemplate: (ts: string) => {
    return {
      adminUserEmail: `unittest-orgadmin+${ts}@example.com`,
      billingAddress: {
        countryCode: 'DK',
        city: 'Copenhagen',
        streetAddress: 'Test Street',
        streetNumber: '1',
        postalCode: '1999',
        firstName: 'Test',
        lastName: 'Org admin',
        identifier: {
          nickName: 'default-billing-address',
        },
        region: '',
      },
      name: `TestOrg AutoApprove ${ts}`,
      taxIdentifier: `TE` + ts,
      pointOfContact: {
        email: `test-contact+${ts}@example.com`,
        phone: '+4512345678',
      },
      dunsIdentifier: 'DUNS-123456789',
      tinIdentifier: 'TIN-123456789',
    };
  },
};

describe.each([PrimaryProvider.COMMERCETOOLS])('Cart B2B Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;
  let company: Company;
  let companyIdentifier: CompanyIdentifier;
  let testOrg: ReturnType<typeof testData.requestTemplate>;
  let identityUsername = '';

  beforeEach(async () => {
    client = createClient(provider);
    const time = new Date().getTime();
    testOrg = testData.requestTemplate(time.toString());
    identityUsername = `testuser+${Date.now()}@example.com`;

    const identity = await client.identity.register({
      username: identityUsername,
      password: 'password1235!',
    });

    if (!identity.success) {
      assert.fail(JSON.stringify(identity.error));
    }

    expect(identity.value.type === 'Registered').toBeTruthy();

    const orgCreateResponse =
      await client.companyRegistration.requestRegistration(testOrg);

    if (!orgCreateResponse.success) {
      assert.fail(JSON.stringify(orgCreateResponse.error));
    }
    expect(orgCreateResponse.value.status).toBe('pending');

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const checkStatusResult =
        await client.companyRegistration.checkRequestStatus({
          requestIdentifier: orgCreateResponse.value.identifier,
        });

      if (!checkStatusResult.success) {
        assert.fail(JSON.stringify(checkStatusResult.error));
      }
      if (checkStatusResult.value.status === 'approved') {
        break;
      }
      if (i == 19) {
        assert.fail(
          'Company registration was not approved within expected time',
        );
      }
    }

    companyIdentifier = orgCreateResponse.value.companyIdentifier;
  }, 15000);


  it('can create a cart and get it by ID', async () => {
    const b2bCart = await client.cart.createCart({
      company: companyIdentifier,
    });

    if (!b2bCart.success) {
      assert.fail(JSON.stringify(b2bCart.error));
    }

    const sameCart = await client.cart.getById({
    cart: b2bCart.value.identifier,
    });

    if (!sameCart.success) {
      assert.fail(JSON.stringify(sameCart.error));
    }

    expect(b2bCart.value.identifier.key).toBe(sameCart.value.identifier.key);
  });

  describe('b2b', () => {
    let cartIdentifier: CartIdentifier | undefined;

    beforeEach(async () => {
      const cleanCart = await client.cart.createCart({
        company: companyIdentifier,
      });

      if (!cleanCart.success) {
        assert.fail(JSON.stringify(cleanCart.error));
      }
      cartIdentifier = cleanCart.value.identifier;
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

    it('can list all b2b carts for a user', async () => {
      const extraCart = await client.cart.createCart({ name: 'First B2B Cart', company: companyIdentifier });

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
          company: companyIdentifier,
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
      expect(extraCartInList.name).toBe('First B2B Cart');
      expect(extraCartInList.company?.taxIdentifier).toBe(companyIdentifier.taxIdentifier);
      expect(extraCartInList.userId).toBeTruthy();
      expect(extraCartInList.identifier.key).toBe(extraCart.value.identifier.key);
      expect(extraCartInList.numItems).toBe(1);

      const originalCartInList = listResult.value.items.find(cart => cart.identifier.key === cartIdentifier?.key);
      if (!originalCartInList) {
        assert.fail('Original cart not found in list');
      }
      expect(originalCartInList).toBeTruthy();
      expect(originalCartInList.name).toBe('');
      expect(originalCartInList.company?.taxIdentifier).toBe(companyIdentifier.taxIdentifier);
      expect(originalCartInList.userId).toBeTruthy();
      expect(originalCartInList.identifier.key).toBe(cartIdentifier?.key);
      expect(originalCartInList.numItems).toBe(0);

    });

    it('seperates b2c and b2b carts', async () => {
      // Create a b2c cart
      const b2cCart = await client.cart.createCart({});

      if (!b2cCart.success) {
        assert.fail(JSON.stringify(b2cCart.error));
      }

      const b2bList = await client.cart.listCarts({
        search: {
          company: companyIdentifier,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
        }
      });

      if (!b2bList.success) {
        assert.fail(JSON.stringify(b2bList.error));
      }

      const b2cList = await client.cart.listCarts({
        search: {
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
        }
      });

      if (!b2cList.success) {
        assert.fail(JSON.stringify(b2cList.error));
      }

      const b2bCartInB2BList = b2bList.value.items.find(cart => cart.identifier.key === cartIdentifier?.key);
      if (!b2bCartInB2BList) {
        assert.fail('B2B cart not found in B2B list');
      }
      expect(b2bCartInB2BList).toBeTruthy();

      const b2cCartInB2CList = b2cList.value.items.find(cart => cart.identifier.key === b2cCart.value.identifier.key);
      if (!b2cCartInB2CList) {
        assert.fail('B2C cart not found in B2C list');
      }
      expect(b2cCartInB2CList).toBeTruthy();


      const b2cCartInB2BList = b2bList.value.items.find(cart => cart.identifier.key === b2cCart.value.identifier.key);
      if (b2cCartInB2BList) {
        assert.fail('B2C cart should not be in B2B list');
      }

      const b2bCartInB2CList = b2cList.value.items.find(cart => cart.identifier.key === cartIdentifier?.key);
      if (b2bCartInB2CList) {
        assert.fail('B2B cart should not be in B2C list');
      }
    });
  });
});
