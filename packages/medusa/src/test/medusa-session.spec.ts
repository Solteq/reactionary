import { createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaAPI } from '../core/client.js';
import { getMedusaTestConfiguration } from './test-utils.js';

/**
 * Exposes the protected clearIdentitySessionData extension point so it can be
 * unit tested without a live Medusa backend - it's pure session bookkeeping,
 * no network involved. transferAnonymousCartToCustomer (the other half of
 * reactionary-cnq.1) takes the real Medusa SDK client and is instead covered
 * by the login/logout integration tests in identity.capability.spec.ts.
 */
class TestableMedusaAPI extends MedusaAPI {
  public exposeClearIdentitySessionData(): void {
    this.clearIdentitySessionData();
  }
}

describe('MedusaAPI session handling (reactionary-cnq.1)', () => {
  it('clears cart and region session data so a different identity does not inherit it', () => {
    const api = new TestableMedusaAPI(getMedusaTestConfiguration(), createInitialRequestContext());

    api.setSessionData({
      activeCartId: { key: 'cart_1' },
      allOwnedCarts: { _me: [{ key: 'cart_1' }] },
      selectedRegion: { id: 'reg_1', name: 'Test region', currency_code: 'eur' },
      allRegions: [{ id: 'reg_1', name: 'Test region', currency_code: 'eur' }],
    });

    api.exposeClearIdentitySessionData();

    const session = api.getSessionData();
    expect(session.activeCartId).toBeUndefined();
    expect(session.allOwnedCarts).toBeUndefined();
    expect(session.selectedRegion).toBeUndefined();
    // allRegions isn't tied to who's logged in - no need to drop it on logout.
    expect(session.allRegions).toEqual([{ id: 'reg_1', name: 'Test region', currency_code: 'eur' }]);
  });
});
