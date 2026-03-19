import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type { Address, Company, CompanyIdentifier } from '@reactionary/core';

const testData = {
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

describe.each([PrimaryProvider.COMMERCETOOLS])('Company - %s', (provider) => {
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

  beforeEach(async () => {
    client = createClient(provider);

    const identity = await client.identity.login({
      username: identityUsername,
      password: 'password1235!',
    });

    if (!identity.success) {
      assert.fail(JSON.stringify(identity.error));
    }

    expect(identity.value.type === 'Registered').toBeTruthy();
  });

  it('returns NotFound for an unknown company identifier', async () => {
    const response = await client.company.getById({
      identifier: {
        taxIdentifier: 'non-existent-tax-id',
      },
    });

    if (response.success) {
      assert.fail();
    }

    expect(response.error.type).toBe('NotFound');
  });

  it('can look up the company by its identifier', async () => {
    const response = await client.company.getById({
      identifier: companyIdentifier,
    });

    if (!response.success) {
      assert.fail(JSON.stringify(response.error));
    }
    expect(response.value.identifier.taxIdentifier).toBe(testOrg.taxIdentifier);
    expect(response.value.name).toBe(testOrg.name);
    expect(response.value.pointOfContact.email).toBe(
      testOrg.pointOfContact.email,
    );
    expect(response.value.pointOfContact.phone).toBe(
      testOrg.pointOfContact.phone,
    );
    expect(response.value.dunsIdentifier).toBe(testOrg.dunsIdentifier);
    expect(response.value.tinIdentifier).toBe(testOrg.tinIdentifier);
    expect(response.value.status).toBe('active');
    expect(response.value.isSelfManagementOfShippingAddressesAllowed).toBe(
      true,
    );
    expect(response.value.isCustomAddressesAllowed).toBe(false);
    expect(response.value.billingAddress).toMatchObject({
      countryCode: testOrg.billingAddress.countryCode,
      city: testOrg.billingAddress.city,
      streetAddress: testOrg.billingAddress.streetAddress,
      streetNumber: testOrg.billingAddress.streetNumber,
      postalCode: testOrg.billingAddress.postalCode,
      firstName: testOrg.billingAddress.firstName,
      lastName: testOrg.billingAddress.lastName,
      identifier: {
        nickName: 'default-billing-address',
      },
      region: '',
    });
  });

  it('should be able to add a shipping address to the profile', async () => {
    const companyResponse = await client.company.getById({
      identifier: companyIdentifier,
    });

    if (!companyResponse.success) {
      assert.fail(JSON.stringify(companyResponse.error));
    }

    company = companyResponse.value;

    const newAddress: Address = {
      identifier: {
        nickName: 'Home',
      },
      firstName: 'John',
      lastName: 'Doe',
      streetAddress: 'Main Street',
      streetNumber: '123',
      city: 'Metropolis',
      region: 'State',
      postalCode: '12345',
      countryCode: 'US',
    };
    const updatedOrg = await client.company.addShippingAddress({
      company: company.identifier,
      address: newAddress,
    });

    if (!updatedOrg.success) {
      console.log(updatedOrg.error);
      assert.fail();
    }
    expect(updatedOrg.value.shippingAddress).toBeDefined();

    expect(updatedOrg.value.alternateShippingAddresses.length).toBe(1);
    expect(updatedOrg.value.alternateShippingAddresses[0]).toMatchObject(
      newAddress,
    );
  });

  describe('Shipping Addresses', () => {
    const newAddress: Address = {
      identifier: {
        nickName: 'Home',
      },
      firstName: 'John',
      lastName: 'Doe',
      streetAddress: 'Main Street',
      streetNumber: '123',
      city: 'Metropolis',
      region: 'State',
      postalCode: '12345',
      countryCode: 'US',
    };
    let org: Company | null;

    beforeEach(async () => {
      const companyResponse = await client.company.getById({
        identifier: companyIdentifier,
      });

      if (!companyResponse.success) {
        assert.fail(JSON.stringify(companyResponse.error));
      }

      company = companyResponse.value;
      const updatedOrg = await client.company.addShippingAddress({
        company: company.identifier,
        address: newAddress,
      });

      if (!updatedOrg.success) {
        console.log(updatedOrg.error);
        assert.fail();
      }

      org = updatedOrg.value;
    });

    it('can make a shipping address the default address', async () => {
      const addressToMakeDefault = org!.alternateShippingAddresses[0];

      const updatedOrg = await client.company.makeShippingAddressDefault({
        company: company!.identifier,
        addressIdentifier: addressToMakeDefault.identifier,
      });

      if (!updatedOrg.success) {
        console.log(updatedOrg.error);
        assert.fail();
      }
      expect(updatedOrg.value.shippingAddress).toBeDefined();
      expect(updatedOrg.value.shippingAddress).toMatchObject(newAddress);
      expect(updatedOrg.value.alternateShippingAddresses.length).toBe(1);
    });

    it('can remove a shipping address from the profile', async () => {
      const addressToRemove = org!.alternateShippingAddresses[0];

      const updatedOrg = await client.company.removeShippingAddress({
        company: company!.identifier,
        addressIdentifier: addressToRemove.identifier,
      });
      if (!updatedOrg.success) {
        console.log(updatedOrg.error);
        assert.fail();
      }

      expect(updatedOrg.value.alternateShippingAddresses.length).toBe(0);
    });

    it('can remove a shipping address from the profile even if it is the default shipping address', async () => {
      const makeDefaultResponse =
        await client.company.makeShippingAddressDefault({
          company: company!.identifier,
          addressIdentifier: org!.alternateShippingAddresses[0].identifier,
        });
      if (!makeDefaultResponse.success) {
        console.log(makeDefaultResponse.error);
        assert.fail();
      }

      const orgWithDefault = makeDefaultResponse.value;
      const addressToRemove = orgWithDefault.shippingAddress!;

      const updatedOrg = await client.company.removeShippingAddress({
        company: company!.identifier,
        addressIdentifier: addressToRemove.identifier,
      });

      if (!updatedOrg.success) {
        console.log(updatedOrg.error);
        assert.fail();
      }
      expect(updatedOrg.value.shippingAddress?.identifier.nickName).not.toBe(
        addressToRemove.identifier.nickName,
      );
      expect(updatedOrg.value.alternateShippingAddresses.length).toBe(0);
    });
  });

  /* We dont support updating the org entity yet so this test is skipped for now, but we want to have it in place for when we do add that functionality
    it.skip('should be able to set the billing address on the company', async () => {
      if (!company) {
        assert.fail();
      }

      const newAddress: Address = {
        identifier: {
          nickName: 'Billing',
        },
        firstName: 'Jane',
        lastName: 'Doe',
        streetAddress: 'Second Street',
        streetNumber: '456',
        city: 'Gotham',
        region: 'State',
        postalCode: '67890',
        countryCode: 'US',
      };
      const updatedProfile = await client.company.setBillingAddress({
        identifier: company.identifier,
        address: newAddress,
      });

      if (!updatedProfile.success) {
        console.log(updatedProfile.error);
        assert.fail();
      }
      expect(updatedProfile.value.billingAddress).toMatchObject(newAddress);
    });

    it('cannot use same nickname for billing and shipping addresses', async () => {
      if (!identity) {
        assert.fail();
      }

      if (identity.type !== 'Registered') {
        assert.fail();
      }
      const newAddress: Address = {
        identifier: {
          nickName: 'SameNick',
        },
        firstName: 'Jane',
        lastName: 'Doe',
        streetAddress: 'Second Street',
        streetNumber: '456',
        city: 'Gotham',
        region: 'State',
        postalCode: '67890',
        countryCode: 'US',
      };
      const billingAddressResponse = await client.profile.setBillingAddress({
        identifier: identity.id,
        address: newAddress,
      });

      if (!billingAddressResponse.success) {
        console.log(billingAddressResponse.error);
        assert.fail();
      }

      const shippingAddressResponse = await client.profile.addShippingAddress({
        identifier: identity.id,
        address: newAddress,
      });
      expect(shippingAddressResponse.success).toBe(false);
    });

    it('cannot set the billing address to an existing shipping address', async () => {
      if (!identity) {
        assert.fail();
      }

      if (identity.type !== 'Registered') {
        assert.fail();
      }
      const newAddress: Address = {
        identifier: {
          nickName: 'SameNick',
        },
        firstName: 'Jane',
        lastName: 'Doe',
        streetAddress: 'Second Street',
        streetNumber: '456',
        city: 'Gotham',
        region: 'State',
        postalCode: '67890',
        countryCode: 'US',
      };
      const shippingAddressResponse = await client.profile.addShippingAddress({
        identifier: identity.id,
        address: newAddress,
      });

      if (!shippingAddressResponse.success) {
        console.log(shippingAddressResponse.error);
        assert.fail();
      }

      const billingAddress = await client.profile.setBillingAddress({
        identifier: identity.id,
        address: shippingAddressResponse.value.alternateShippingAddresses[0]
      });
      expect(billingAddress.success).toBe(false);
    });
*/
});
