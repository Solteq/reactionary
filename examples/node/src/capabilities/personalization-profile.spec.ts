import 'dotenv/config';
import { createClient, PrimaryProvider } from '../utils.js';
import { type FeatureFlag } from '@reactionary/core';

const testData = {
  userInGroup: 'claude_kessler@example.com'
}

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])(
  'Marketing profile',
  (provider) => {
    let client: ReturnType<typeof createClient>;
    beforeEach(() => {
      client = createClient(provider);
    });

   it('can get a personalization profile for an anonymous user', async () => {
      const selfResponse = await client.identity.getSelf({});
      if (!selfResponse.success) {
        assert.fail(JSON.stringify(selfResponse.error));
      }
      expect(selfResponse.value.type).toBe('Anonymous');

      const result = await client.personalizationProfile.getPersonalizationProfile({
        identity: selfResponse.value
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }

      expect(result.value.identifier.key).toBeTruthy();
    });

    it('can get the personalization profile for a guest user', async () => {
      const cartResult = await client.cart.createCart({});
      if (!cartResult.success) {
        assert.fail(JSON.stringify(cartResult.error));
      }
      const selfResponse = await client.identity.getSelf({}); // Ensure identity is upgraded to guest
      if (!selfResponse.success) {
        assert.fail(JSON.stringify(selfResponse.error));
      }

      expect(selfResponse.value.type).toBe('Guest');
      if (selfResponse.value.type !== 'Guest') {
        assert.fail('Identity should be of type Guest');
      }

      const result = await client.personalizationProfile.getPersonalizationProfile({
        identity: selfResponse.value,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }
      expect(result.value.identifier.key).toBeTruthy();
    });

    it('can get the personalization profile for a registered user', async () => {
      const time = new Date().getTime();
      const registrationResult = await client.identity.register({
        username: `user_${time}@example.com`,
        password: 'Test1234!',
      });

      if (!registrationResult.success) {
        assert.fail(JSON.stringify(registrationResult.error));
      }

      const selfResponse = await client.identity.getSelf({});
      if (!selfResponse.success) {
        assert.fail(JSON.stringify(selfResponse.error));
      }

      expect(selfResponse.value.type).toBe('Registered');
      if (selfResponse.value.type !== 'Registered') {
        assert.fail('Identity should be of type Registered');
      }

      const result = await client.personalizationProfile.getPersonalizationProfile({
        identity: selfResponse.value,
      });

      if (!result.success) {
        assert.fail(JSON.stringify(result.error));
      }
      expect(result.value.identifier.key).toBeTruthy();
      // we also want to make sure that the personalization profile we get back is not tied to the anonymous identity, but is a new one for the registered user
    });

    it('can get groups for a registered user and return them as segments in the personalization profile', async () => {
      const time = new Date().getTime();
      const registrationResult = await client.identity.login({
        username: testData.userInGroup,
        password: 'Test1234!'
      });

      if (!registrationResult.success) {
        assert.fail(JSON.stringify(registrationResult.error));
      }

      const personalizationProfileResult = await client.personalizationProfile.getPersonalizationProfile({
        identity: registrationResult.value,
      });

      if (!personalizationProfileResult.success) {
        assert.fail(JSON.stringify(personalizationProfileResult.error));
      }

      expect(personalizationProfileResult.value.identifier.key).toBeTruthy();
      expect(personalizationProfileResult.value.segments).toContain('Test-Do-Not-Delete');
    });

  },
);
