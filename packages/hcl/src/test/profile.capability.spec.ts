import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProfileSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { HclProfileCapability } from '../capabilities/profile.capability.js';
import { HclProfileFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type { HclWcsIdentityResponse } from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';

const hasCredentials = !!process.env['HCL_USER'] && !!process.env['HCL_PASS'];

describe.skipIf(!hasCredentials)('HCL Profile Capability', () => {
  let provider: HclProfileCapability;
  let reqCtx: RequestContext;
  let client: HclClient;

  beforeAll(async () => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    client = new HclClient(config, reqCtx);

    // Login with registered user
    const loginResponse = await client.callPost<HclWcsIdentityResponse>(
      `${client.transactionBaseUrl}/loginidentity`,
      {
        logonId: process.env['HCL_USER'],
        logonPassword: process.env['HCL_PASS'],
      },
    );
    reqCtx.session['hcl.WCToken'] = loginResponse.WCToken;
    reqCtx.session['hcl.WCTrustedToken'] = loginResponse.WCTrustedToken;
    reqCtx.session['hcl.userId'] = loginResponse.userId;
    reqCtx.session['hcl.identityType'] = 'registered';
  });

  beforeEach(() => {
    const config = getHclTestConfiguration();
    provider = new HclProfileCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProfileFactory(ProfileSchema),
    );
  });

  it('should return the authenticated user profile', async () => {
    const result = await provider.getById({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.email).toBeTruthy();
  });

  it('should update profile email and phone', async () => {
    const profileResult = await provider.getById({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
    });
    expect(profileResult.success).toBe(true);
    if (!profileResult.success) return;

    const original = profileResult.value;

    const updated = await provider.update({
      identifier: original.identifier,
      email: original.email,
      phone: original.phone ?? '',
    });
    expect(updated.success).toBe(true);
  });

  it('should add a shipping address', async () => {
    const result = await provider.addShippingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      address: {
        identifier: { nickName: 'TestAddr_' + Date.now() },
        firstName: 'Test',
        lastName: 'User',
        streetAddress: 'Test Street 1',
        streetNumber: '',
        city: 'Helsinki',
        region: '',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should update an existing shipping address', async () => {
    const profileResult = await provider.getById({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
    });
    expect(profileResult.success).toBe(true);
    if (!profileResult.success) return;

    const addresses = profileResult.value.alternateShippingAddresses ?? [];
    if (addresses.length === 0) {
      console.warn('No shipping addresses to update — skipping');
      return;
    }

    const addr = addresses[0];
    const result = await provider.updateShippingAddress({
      identifier: profileResult.value.identifier,
      address: { ...addr, city: 'Espoo' },
    });
    expect(result.success).toBe(true);
  });

  it('should return NotFound when updating a non-existent address', async () => {
    const result = await provider.updateShippingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      address: {
        identifier: { nickName: 'DoesNotExist_' + Date.now() },
        firstName: 'Ghost',
        lastName: 'User',
        streetAddress: 'Nowhere',
        streetNumber: '',
        city: 'Void',
        region: '',
        postalCode: '00000',
        countryCode: 'FI',
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('NotFound');
  });

  it('should remove a shipping address', async () => {
    // Add one first so we have something to remove
    const nick = 'ToDelete_' + Date.now();
    const addResult = await provider.addShippingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      address: {
        identifier: { nickName: nick },
        firstName: 'Delete',
        lastName: 'Me',
        streetAddress: 'Temp St 1',
        streetNumber: '',
        city: 'Helsinki',
        region: '',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });
    expect(addResult.success).toBe(true);

    const removeResult = await provider.removeShippingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      addressIdentifier: { nickName: nick },
    });
    expect(removeResult.success).toBe(true);
  });

  it('should return NotFound when removing a non-existent address', async () => {
    const result = await provider.removeShippingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      addressIdentifier: { nickName: 'DoesNotExist_' + Date.now() },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe('NotFound');
  });

  it('should set a default shipping address', async () => {
    const profileResult = await provider.getById({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
    });
    expect(profileResult.success).toBe(true);
    if (!profileResult.success) return;

    const addresses = profileResult.value.alternateShippingAddresses ?? [];
    if (addresses.length === 0) {
      console.warn('No shipping addresses to make default — skipping');
      return;
    }

    const result = await provider.makeShippingAddressDefault({
      identifier: profileResult.value.identifier,
      addressIdentifier: addresses[0].identifier,
    });
    expect(result.success).toBe(true);
  });

  it('should set the billing address (upsert)', async () => {
    const result = await provider.setBillingAddress({
      identifier: { userId: reqCtx.session['hcl.userId'] as string },
      address: {
        identifier: { nickName: 'Billing' },
        firstName: 'Billing',
        lastName: 'User',
        streetAddress: 'Billing Ave 1',
        streetNumber: '',
        city: 'Helsinki',
        region: '',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });
    expect(result.success).toBe(true);
  });
});
