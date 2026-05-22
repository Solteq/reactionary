import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  PersonalizationProfileSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { HclPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import { HclPersonalizationProfileFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { SESSION_KEY_PERSONALIZATION_ID } from '../core/session-keys.js';
import { getHclTestConfiguration } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
describe('HCL Personalization Profile Capability', () => {
  let provider: HclPersonalizationProfileCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclPersonalizationProfileCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclPersonalizationProfileFactory(PersonalizationProfileSchema),
    );
  });

  it('should return an anonymous profile when no personalization ID is in session', async () => {
    const result = await provider.getPersonalizationProfile({
      identity: { type: 'Anonymous' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.key).toBe('anonymous');
    expect(result.value.segments).toEqual([]);
  });

  it('should return a profile with the personalization ID from session', async () => {
    // Use a synthetic personalization ID — segments may be empty if unknown to the server
    reqCtx.session[SESSION_KEY_PERSONALIZATION_ID] = '1234567890';

    const result = await provider.getPersonalizationProfile({
      identity: { type: 'Anonymous' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.key).toBe('1234567890');
    expect(Array.isArray(result.value.segments)).toBe(true);
  });

  it('should return an empty segments array when the personalization ID is unknown', async () => {
    reqCtx.session[SESSION_KEY_PERSONALIZATION_ID] =
      'unknown-id-that-has-no-segments';

    const result = await provider.getPersonalizationProfile({
      identity: { type: 'Anonymous' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.segments).toEqual([]);
  });
});
