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

describe('Commercetools Profile Provider', () => {
  let provider: CommercetoolsProfileProvider;
  let identityProvider: CommercetoolsIdentityProvider;
  let reqCtx: RequestContext;

  beforeAll(() => {
    provider = new CommercetoolsProfileProvider(
      getCommercetoolsTestConfiguration(),
      ProfileSchema,
      new NoOpCache()
    );

    identityProvider = new CommercetoolsIdentityProvider(
      getCommercetoolsTestConfiguration(),
      IdentitySchema,
      new NoOpCache()
    );
  });

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();

    const time = new Date().getTime();

    await identityProvider.register({
        username: `martin.rogne+test-${ time }@solteq.com`,
        password: 'love2test'
    }, reqCtx);
  });

  it('should be able to fetch the profile for the current user', async () => {
    const profile = await provider.getSelf({}, reqCtx);

    expect(profile).toBeDefined();
    expect(profile.email).toContain('martin.rogne');
  });
});
