// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclClient } from '../core/client.js';
import { HclCartFactory } from '../factories/index.js';
import { getHclTestConfiguration } from './test-utils.js';

const testData = {
  partNumber: 'DR-CHRS-0001-0001',
};

describe('HCL auto guest-session upgrade', () => {
  let provider: HclCartCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    // No session tokens set — the client bootstraps a guest session on the
    // first transaction call via ensureGuestSession().
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const hclClient = new HclClient(config, reqCtx);
    provider = new HclCartCapability(
      new NoOpCache(),
      reqCtx,
      config,
      hclClient,
      new HclCartFactory(
        CartSchema,
        CartIdentifierSchema,
        CartPaginatedSearchResultSchema,
      ),
    );
  });

  afterEach(async () => {
    try {
      await provider.deleteCart({ cart: { key: '' } });
    } catch {
      // ignore — cart may already be gone or was never created
    }
  });

  it('should bootstrap a guest session and succeed without prior authentication', async () => {
    expect(reqCtx.session['hcl.WCToken']).toBeUndefined();

    const result = await provider.add({
      cart: { key: '' },
      variant: { sku: testData.partNumber },
      quantity: 1,
    });

    expect(
      result.success,
      `Expected success, got: ${JSON.stringify(result)}`,
    ).toBe(true);
    if (!result.success) return;

    // Session must now contain guest tokens written by ensureGuestSession.
    expect(reqCtx.session['hcl.WCToken']).toBeTruthy();
    expect(reqCtx.session['hcl.WCTrustedToken']).toBeTruthy();
    expect(reqCtx.session['hcl.userId']).toBeTruthy();
    expect(reqCtx.session['hcl.identityType']).toBe('guest');

    // Cart operation itself must have succeeded.
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].variant.sku).toBe(testData.partNumber);
    expect(result.value.items[0].quantity).toBe(1);
  });

  it('should reuse the existing guest session on subsequent calls', async () => {
    // First call — no token present, auto-upgrade fires.
    const firstResult = await provider.add({
      cart: { key: '' },
      variant: { sku: testData.partNumber },
      quantity: 1,
    });
    expect(
      firstResult.success,
      `Expected success, got: ${JSON.stringify(firstResult)}`,
    ).toBe(true);

    const tokenAfterFirst = reqCtx.session['hcl.WCToken'] as string;
    expect(tokenAfterFirst).toBeTruthy();

    // Second call — token already present, ensureGuestSession must skip.
    const secondResult = await provider.add({
      cart: { key: '' },
      variant: { sku: testData.partNumber },
      quantity: 1,
    });
    expect(
      secondResult.success,
      `Expected success, got: ${JSON.stringify(secondResult)}`,
    ).toBe(true);

    // The WCToken must be unchanged — the same guest session was reused.
    expect(reqCtx.session['hcl.WCToken']).toBe(tokenAfterFirst);
  });
});
