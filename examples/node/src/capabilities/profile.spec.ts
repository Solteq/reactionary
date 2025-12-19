import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import { IdentityIdentifierSchema, type Address, type Identity, type IdentityIdentifier, type Profile } from '@reactionary/core';

describe.each([PrimaryProvider.MEDUSA, PrimaryProvider.COMMERCETOOLS])(
  'Profile Capability - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;
    let identity: Identity | null = null;
    let identityIdentifier: IdentityIdentifier | null = null;

    beforeEach(async () => {
      client = createClient(provider);
      const time = new Date().getTime();

      const identityResponse = await client.identity.register({
        username: `martin.rogne+test-${time}@solteq.com`,
        password: 'love2test',
      });

      if (!identityResponse.success) {
        assert.fail();
      }

      identity = identityResponse.value;
      if (identity.type !== 'Registered') {
        assert.fail();
      }
      identityIdentifier = identity.id;
    });

    it('should be able to fetch the profile for the current user', async () => {
      const time = new Date().getTime();
      if (!identity) {
        assert.fail();
      }

      if (identity.type !== 'Registered') {
        assert.fail();
      }

      const profile = await client.profile.getById({
        identifier: identity.id,
      });

      if (!profile.success) {
        console.log(profile.error);
        assert.fail();
      }

      expect(profile.value.email).toContain('martin.rogne');
    });

    it('should be able to update the profile for the current user', async () => {

      const time = new Date().getTime();
      const updatedProfile = await client.profile.update({
        identifier: identityIdentifier!,
        phone: '+4712345678',
        email: `martin.rogne+test-${time}-a@solteq.com`,
      });

      if (!updatedProfile.success) {
        console.log(updatedProfile.error);
        assert.fail();
      }

      expect(updatedProfile.value.email).toBe(
        `martin.rogne+test-${time}-a@solteq.com`
      );
      expect(updatedProfile.value.phone).toBe('+4712345678');
      expect(updatedProfile.value.billingAddress).toBeUndefined();
    });

    it('should be able to set the billing address on the profile', async () => {
      if (!identity) {
        assert.fail();
      }

      if (identity.type !== 'Registered') {
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
      const updatedProfile = await client.profile.setBillingAddress({
        identifier: identity.id,
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


    it('should be able to add a shipping address to the profile', async () => {
      if (!identity) {
        assert.fail();
      }

      if (identity.type !== 'Registered') {
        assert.fail();
      }

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
      const updatedProfile = await client.profile.addShippingAddress({
        identifier: identity.id,
        address: newAddress,
      });

      if (!updatedProfile.success) {
        console.log(updatedProfile.error);
        assert.fail();
      }
      expect(updatedProfile.value.shippingAddress).toBeUndefined();

      expect(updatedProfile.value.alternateShippingAddresses.length).toBe(1);
      expect(updatedProfile.value.alternateShippingAddresses[0]).toMatchObject(
        newAddress
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
      let profile: Profile | null;

      beforeEach(async () => {
        const updatedProfile = await client.profile.addShippingAddress({
          identifier: identityIdentifier!,
          address: newAddress,
        });

        if (!updatedProfile.success) {
          console.log(updatedProfile.error);
          assert.fail();
        }

        profile = updatedProfile.value;
      });

      it('can make a shipping address the default address', async () => {
        const addressToMakeDefault =
          profile!.alternateShippingAddresses[0];

        const updatedProfile = await client.profile.makeShippingAddressDefault({
          identifier: identityIdentifier!,
          addressIdentifier: addressToMakeDefault.identifier,
        });

        if (!updatedProfile.success) {
          console.log(updatedProfile.error);
          assert.fail();
        }
        expect(updatedProfile.value.shippingAddress).toBeDefined();
        expect(updatedProfile.value.shippingAddress).toMatchObject(newAddress);
        expect(updatedProfile.value.alternateShippingAddresses.length).toBe(0);
      });

      it('can remove a shipping address from the profile', async () => {
        const addressToRemove =
          profile!.alternateShippingAddresses[0];

        const updatedProfile = await client.profile.removeShippingAddress({
          identifier: identityIdentifier!,
          addressIdentifier: addressToRemove.identifier,
        });
        if (!updatedProfile.success) {
          console.log(updatedProfile.error);
          assert.fail();
        }

        expect(updatedProfile.value.alternateShippingAddresses.length).toBe(0);
      });

      it('can remove a shipping address from the profile even if it is the default shipping address', async () => {
        const makeDefaultResponse = await client.profile.makeShippingAddressDefault({
          identifier: identityIdentifier!,
          addressIdentifier: profile!.alternateShippingAddresses[0].identifier,
        });
        if (!makeDefaultResponse.success) {
          console.log(makeDefaultResponse.error);
          assert.fail();
        }

        const profileWithDefault = makeDefaultResponse.value;
        const addressToRemove = profileWithDefault.shippingAddress!;

        const updatedProfile = await client.profile.removeShippingAddress({
          identifier: identityIdentifier!,
          addressIdentifier: addressToRemove.identifier,
        });

        if (!updatedProfile.success) {
          console.log(updatedProfile.error);
          assert.fail();
        }
        expect(updatedProfile.value.shippingAddress).toBeUndefined();
        expect(updatedProfile.value.alternateShippingAddresses.length).toBe(0);
      });
    });
  }
);
