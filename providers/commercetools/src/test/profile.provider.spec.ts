import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  IdentitySchema,
  NoOpCache,
  ProfileSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { CommercetoolsProfileProvider } from '../providers/profile.provider.js';
import { CommercetoolsIdentityProvider } from '../providers/identity.provider.js';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

describe('Commercetools Profile Provider', () => {
  let provider: CommercetoolsProfileProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config);
    const userClient = client.getClient(reqCtx);

    provider = new CommercetoolsProfileProvider(
      config,
      ProfileSchema,
      new NoOpCache(),
      reqCtx,
      userClient
    );

    identityProvider = new CommercetoolsIdentityProvider(
      config,
      IdentitySchema,
      new NoOpCache(),
      reqCtx,
      client
    );

    const time = new Date().getTime();

    await identityProvider.register({
      username: `martin.rogne+test-${time}@solteq.com`,
      password: 'love2test',
    });
  });

  it('should be able to fetch the profile for the current user', async () => {
    const profile = await provider.getSelf({});

    expect(profile).toBeDefined();
    expect(profile.email).toContain('martin.rogne');
  });
});
