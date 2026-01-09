import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { getFakerTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { FakeProfileProvider } from '../providers/profile.provider.js';

describe('Fake Profile Provider', () => {
  let provider: FakeProfileProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeProfileProvider(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx
    );
  });

  describe('should have operations return structurally valid data', () => {
    it('for getById', async () => {
      const result = await provider.getById({
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for addShippingAddress', async () => {
      const result = await provider.addShippingAddress({
        address: {
          city: 'City',
          countryCode: 'DK',
          firstName: 'FirstName',
          lastName: 'LastName',
          identifier: {
            nickName: '1234Fake',
          },
          postalCode: '2300',
          region: 'Region',
          streetAddress: 'StreetAddress',
          streetNumber: '42',
        },
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for makeShippingAddressDefault', async () => {
      const result = await provider.makeShippingAddressDefault({
        addressIdentifier: {
          nickName: '1234Fake',
        },
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for removeShippingAddress', async () => {
      const result = await provider.removeShippingAddress({
        addressIdentifier: {
          nickName: '1234Fake',
        },
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for setBillingAddress', async () => {
      const result = await provider.setBillingAddress({
        address: {
          city: 'City',
          countryCode: 'DK',
          firstName: 'FirstName',
          lastName: 'LastName',
          identifier: {
            nickName: '1234Fake',
          },
          postalCode: '2300',
          region: 'Region',
          streetAddress: 'StreetAddress',
          streetNumber: '42',
        },
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for update', async () => {
      const result = await provider.update({
        email: 'foo@example.com',
        identifier: {
          userId: '1234',
        },
        phone: '40102030',
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });

    it('for updateShippingAddress', async () => {
      const result = await provider.updateShippingAddress({
        address: {
          city: 'City',
          countryCode: 'DK',
          firstName: 'FirstName',
          lastName: 'LastName',
          identifier: {
            nickName: '1234Fake',
          },
          postalCode: '2300',
          region: 'Region',
          streetAddress: 'StreetAddress',
          streetNumber: '42',
        },
        identifier: {
          userId: '1234',
        },
      });

      if (!result.success) {
        assert.fail();
      }

      expect(result.value.identifier.userId).toBe('1234');
    });
  });
});
