import { config } from 'dotenv';
import {
  NoOpCache,
  createInitialRequestContext,
  type Identity,
  type PersonalizationProfileIdentifier,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { UnomiPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import { PersonalizationProfileSchema } from '@reactionary/core';
import { UnomiConfigurationSchema } from '../schema/configuration.schema.js';

config({ path: '../../.env' });

  const testData = {
    profileId: '3d9fc039-2c18-4f47-b0c5-294f62c73e6d',
    scope: 'reactionary-storefront'
  };


function createCapability() {
  const context = createInitialRequestContext();

  const cfg = UnomiConfigurationSchema.parse({
      apiUrl: process.env.UNOMI_API_URL!,
      scope: testData.scope,
      username: process.env.UNOMI_USERNAME!,
      password: process.env.UNOMI_PASSWORD!,
      profilePath: '/cxs/profiles',
    });
  const capability = new UnomiPersonalizationProfileCapability(
    cfg,
    new NoOpCache(),
    context,
    new UnomiPersonalizationProfileFactory(PersonalizationProfileSchema),
  );

  return { capability, context };
}

describe('Unomi personalization profile capability', () => {
  it('hashes a registered identity user ID', async () => {
    const { capability } = createCapability();


    const identity = { type: 'Registered', id: { userId: 'user-123' } } satisfies Identity;
    const personalizationProfile = await capability.getPersonalizationProfile({ identity });
    if (!personalizationProfile.success) {
      throw new Error(`Failed to get personalization profile: ${personalizationProfile.error}`);
    }
    expect(personalizationProfile.value.identifier.key).toBeDefined();
    expect(personalizationProfile.value.identifier.key).not.toBe('user-123');
  });

  it('creates and reuses a hashed anonymous identity ID in the session', async () => {
    const { capability } = createCapability();

    const identity = { type: 'Anonymous'  } satisfies Identity;
    const personalizationProfile = await capability.getPersonalizationProfile({ identity });
    if (!personalizationProfile.success) {
      throw new Error(`Failed to get personalization profile: ${personalizationProfile.error}`);
    }
    expect(personalizationProfile.value.identifier.key).toBeDefined();
    expect(personalizationProfile.value.identifier.key).not.toBe('anonymous');

  });

  it('can load an existing profile', async () => {
    const { capability } = createCapability();

    const personalizationId = { key: testData.profileId } satisfies PersonalizationProfileIdentifier;

    const identity = { type: 'Registered', id: { userId: 'user-cfr-123' } } satisfies Identity;
    const personalizationProfile = await capability.getPersonalizationProfile({ identity, personalizationProfileIdentifier: personalizationId });

    if (!personalizationProfile.success) {
      throw new Error(`Failed to get personalization profile: ${personalizationProfile.error}`);
    }
    expect(personalizationProfile.value.identifier.key).toBe(testData.profileId);
    expect(personalizationProfile.value.segments).toBeDefined();
    expect(Array.isArray(personalizationProfile.value.segments)).toBe(true);
    expect(personalizationProfile.value.segments.length).toBeGreaterThan(0);
    console.log('Segments:', personalizationProfile.value.segments);
  });
});
