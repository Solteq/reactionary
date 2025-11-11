import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

describe.each([PrimaryProvider.COMMERCETOOLS])('Profile Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should be able to fetch the profile for the current user', async () => {
    const time = new Date().getTime();

    await client.identity.register({
      username: `martin.rogne+test-${time}@solteq.com`,
      password: 'love2test',
    });

    const profile = await client.profile.getSelf({});

    expect(profile).toBeDefined();
    expect(profile.email).toContain('martin.rogne');
  });
});
