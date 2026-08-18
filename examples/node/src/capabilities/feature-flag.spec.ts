import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { type FeatureFlag } from '@reactionary/core';

describe.each([PrimaryProvider.FAKE])('Feature flag', (provider) => {
  let client: ReturnType<typeof createClient>;
  const flags: FeatureFlag[] = [];
  beforeEach(() => {
    client = createClient(provider);
  });

  it('can get a list of feature flags', async () => {
    const result = await client.featureFlag.getFlags({
      featureFlagIdentifiers: [{ key: 'true-flag' }, { key: 'string-flag' }],
      personalizationProfile: {
        identifier: {
          key: 'default-personalization-profile',
        },
        segments: [],
        blurb: '',
      },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.length).toBe(2);
    expect(result.value[0].identifier.key).toBe('true-flag');
    expect(result.value[1].identifier.key).toBe('string-flag');
  });

  describe('isEnabled', () => {
    beforeEach(async () => {
      const result = await client.featureFlag.getFlags({
        featureFlagIdentifiers: [{ key: 'true-flag' }, { key: 'string-flag' }],
        personalizationProfile: {
          identifier: {
            key: 'default-personalization-profile',
          },
          segments: [],
          blurb: '',
        },
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      flags.push(...result.value);
    });

    it('should be able to get a feature flag value for a string flag', async () => {
      expect(client.featureFlag.isEnabled(flags, 'string-flag', 'blue')).toBe(
        true,
      );
      expect(client.featureFlag.isEnabled(flags, 'string-flag', 'red')).toBe(
        false,
      );
    });

    it('should be able to get a feature flag value for a boolean flag', async () => {
      expect(client.featureFlag.isEnabled(flags, 'true-flag')).toBe(true);
    });

    it('should return false for a non existing flag', async () => {
      expect(client.featureFlag.isEnabled(flags, 'non-existing-flag')).toBe(
        false,
      );
    });
  });
});
