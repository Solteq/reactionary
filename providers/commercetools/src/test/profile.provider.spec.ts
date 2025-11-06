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

describe('Commercetools Profile Provider', () => {
  let provider: CommercetoolsProfileProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
    provider = new CommercetoolsProfileProvider(
      getCommercetoolsTestConfiguration(),
      ProfileSchema,
      new NoOpCache(),
      reqCtx
    );

    identityProvider = new CommercetoolsIdentityProvider(
      getCommercetoolsTestConfiguration(),
      IdentitySchema,
      new NoOpCache(),
      reqCtx
    );

    const time = new Date().getTime();

    await identityProvider.register({
        username: `martin.rogne+test-${ time }@solteq.com`,
        password: 'love2test'
    });
  });

  it('should be able to fetch the profile for the current user', async () => {
    const profile = await provider.getSelf({});

    expect(profile).toBeDefined();
    expect(profile.email).toContain('martin.rogne');
  });
});
