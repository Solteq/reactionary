import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  request: (ts: string) =>  {
      return {
        adminUserEmail:  `test-orgadmin+${ts}@example.com`,
        billingAddress: {
          countryCode: 'DK',
          city: 'Copenhagen',
          streetAddress: 'Test Street',
          streetNumber: '1',
          postalCode: '1999',
          firstName: 'Test',
          lastName: 'Org admin',
          identifier: {
            nickName: 'default-billing-address'
          },
          region: ''
        },
        name: `Test Organization ${ts}`,
        taxIdentifier: `TE` + ts,
        pointOfContact: {
          email:  `test-contact+${ts}@example.com`,
          phone: '+4512345678',
        },
        dunsIdentifier: 'DUNS-123456789',
        tinIdentifier: 'TIN-123456789',
      };
    }
  }

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Company Registration - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    describe('Unauthenticated sessions', () => {
      it('cannot register an organiation as a guest user', async () => {
        const data = testData.request(Date.now().toString());
        const result = await client.companyRegistration.requestRegistration(data);

        if (result.success) {
          assert.fail('Expected registration to fail for guest user');
        }

        expect(result.error.type).toBe('Generic');
      });
    });

    describe('authenticated sessions', () => {
      beforeEach(async () => {
        const identity = await client.identity.register({
          username: `testuser+${Date.now()}@example.com`,
          password: 'password1235!'
        });

        if(!identity.success) {
          assert.fail(JSON.stringify(identity.error));
        }

        expect(identity.value.type === 'Registered').toBeTruthy();
      });

    it('should be able to register a company', async () => {
      const data = testData.request(Date.now().toString());
      const result = await client.companyRegistration.requestRegistration(data);

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.identifier).toBeDefined();
      expect(result.value.status).toBe('pending');
      expect(result.value.name).toBe(data.name);
      expect(result.value.pointOfContact.email).toBe(data.pointOfContact.email);
      expect(result.value.companyIdentifier.taxIdentifier).toBe(data.taxIdentifier);
    });


    it('should be able to register a company and have it autoapproved', async () => {
      const data = testData.request(Date.now().toString());
      data.name = 'TestOrg AutoApprove ' + new Date().getTime();
      const result = await client.companyRegistration.requestRegistration(data);

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.identifier).toBeDefined();
      expect(result.value.status).toBe('pending');
      expect(result.value.name).toBe(data.name);
      expect(result.value.pointOfContact.email).toBe(data.pointOfContact.email);
      expect(result.value.companyIdentifier.taxIdentifier).toBe(data.taxIdentifier);

      for(let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const checkStatusResult = await client.companyRegistration.checkRequestStatus({
          requestIdentifier: result.value.identifier
        });
        if (!checkStatusResult.success) {
          assert.fail(JSON.stringify(checkStatusResult.error));
        }

        if (checkStatusResult.value.status === 'approved') {
          break;
        }
        if (i === 19) {
          assert.fail('Company registration was not auto-approved within expected time');
        }
      }

    }, 25000 );

    it('should be able to check the registration status of a company', async () => {
      const data = testData.request(Date.now().toString());
      const registrationResult = await client.companyRegistration.requestRegistration(data);
      if (!registrationResult.success) {
        assert.fail(JSON.stringify(registrationResult.error));
      }

      const checkStatusResult = await client.companyRegistration.checkRequestStatus({
        requestIdentifier: registrationResult.value.identifier
      });

      if (!checkStatusResult.success) {
        assert.fail(JSON.stringify(checkStatusResult.error));
      }

      expect(checkStatusResult.value.identifier).toBeDefined();
      expect(checkStatusResult.value.status).toBe('pending');
      expect(checkStatusResult.value.name).toBe(data.name);
      expect(checkStatusResult.value.pointOfContact.email).toBe(data.pointOfContact.email);
      expect(checkStatusResult.value.companyIdentifier.taxIdentifier).toBe(data.taxIdentifier);
    });
  });
})
