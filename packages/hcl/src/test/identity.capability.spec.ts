import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  IdentitySchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclIdentityCapability } from '../capabilities/identity.capability.js';
import { HclIdentityFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type { HclWcsIdentityResponse } from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach } from 'vitest';

describe('HCL Identity Capability', () => {
  let provider: HclIdentityCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclIdentityCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclIdentityFactory(IdentitySchema),
    );
  });

  it('should return anonymous identity when no session is active', async () => {
    const result = await provider.getSelf({});

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.type).toBe('Anonymous');
  });

  it('should return guest identity after creating a guest session', async () => {
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);

    // Create a guest session via callPost (createGuestIdentity moved to capability)
    const guestResponse = await client.callPost<HclWcsIdentityResponse>(
      `${client.transactionBaseUrl}/guestidentity`,
    );
    expect(guestResponse.WCToken).toBeTruthy();
    expect(guestResponse.WCTrustedToken).toBeTruthy();
    expect(guestResponse.userId).toBeTruthy();

    // Simulate the context having been populated by a prior guest session
    reqCtx.session['hcl.WCToken'] = guestResponse.WCToken;
    reqCtx.session['hcl.WCTrustedToken'] = guestResponse.WCTrustedToken;
    reqCtx.session['hcl.userId'] = guestResponse.userId;
    reqCtx.session['hcl.identityType'] = 'guest';

    const result = await provider.getSelf({});
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.type).toBe('Guest');
    if (result.value.type !== 'Guest') return;
    expect(result.value.id.userId).toBe(guestResponse.userId);
  });

  it('should return anonymous identity after logout', async () => {
    // Simulate a guest session being active
    reqCtx.session['hcl.WCToken'] = 'fake-token';
    reqCtx.session['hcl.WCTrustedToken'] = 'fake-trusted';
    reqCtx.session['hcl.userId'] = '99';
    reqCtx.session['hcl.identityType'] = 'guest';

    const result = await provider.logout({});

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.type).toBe('Anonymous');
    // Session tokens should be cleared
    expect(reqCtx.session['hcl.WCToken']).toBeUndefined();
    expect(reqCtx.session['hcl.WCTrustedToken']).toBeUndefined();
    expect(reqCtx.session['hcl.identityType']).toBeUndefined();
  });

  // Login and register tests require a test user — skipped until credentials
  // are added to .test.env as HCL_USER / HCL_PASS.
  it.skipIf(!process.env['HCL_USER'])(
    'should login and return a registered identity',
    async () => {
      const hclUser = process.env['HCL_USER'] ?? '';
      const hclPass = process.env['HCL_PASS'] ?? '';

      const result = await provider.login({
        username: hclUser,
        password: hclPass,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.value.type).toBe('Registered');
      if (result.value.type !== 'Registered') return;
      expect(result.value.id.userId).toBeTruthy();

      // Session should now contain WCS tokens
      expect(reqCtx.session['hcl.WCToken']).toBeTruthy();
      expect(reqCtx.session['hcl.identityType']).toBe('registered');
    },
  );
});
