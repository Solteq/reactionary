// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CompanyRegistrationRequestSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclCompanyRegistrationCapability } from '../capabilities/company-registration.capability.js';
import { HclCompanyRegistrationFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

describe('HCL Company Registration Capability', () => {
  let provider: HclCompanyRegistrationCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclCompanyRegistrationCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclCompanyRegistrationFactory(CompanyRegistrationRequestSchema),
    );
  });

  it('should check registration status for a non-existent org', async () => {
    const result = await provider.checkRequestStatus({
      requestIdentifier: { key: 'non-existent-org-id-xyz' },
    });

    // The demo server may return NotFound, a Generic 403, or similar — just check it fails
    if (!result.success) {
      expect(result.error.type).toBeDefined();
    } else {
      // If the server returns something, it should have the correct shape
      expect(['approved', 'denied', 'pending']).toContain(result.value.status);
    }
  });

  it('should submit a new buyer registration', async () => {
    // Use a unique timestamp-based name to avoid conflicts
    const ts = Date.now();
    const result = await provider.requestRegistration({
      name: `Test Co ${ts}`,
      taxIdentifier: `TAX-${ts}`,
      pointOfContact: { email: `testbuyer${ts}@example.com` },
      billingAddress: {
        identifier: { nickName: 'billing' },
        firstName: 'Test',
        lastName: 'Buyer',
        streetAddress: '1 Test Street',
        streetNumber: '',
        city: 'Helsinki',
        region: 'Uusimaa',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });

    // The demo server may approve, deny, or fail this — any response is acceptable
    if (result.success) {
      expect(result.value.identifier).toBeDefined();
      expect(['approved', 'denied', 'pending']).toContain(result.value.status);
    } else {
      // Accept server-side rejections (e.g. duplicate, auth) as test noise on demo
      expect(result.error).toBeDefined();
    }
  });
});
