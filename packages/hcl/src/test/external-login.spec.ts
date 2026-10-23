import { IdentitySchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { FakeOidcProvider, runExternalLoginConformance } from '@reactionary/oidc/testing';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HclIdentityCapability } from '../capabilities/identity.capability.js';
import { HclClient } from '../core/client.js';
import {
  SESSION_KEY_IDENTITY_TYPE,
  SESSION_KEY_USER_ID,
  SESSION_KEY_WC_TOKEN,
  SESSION_KEY_WC_TRUSTED_TOKEN,
} from '../core/session-keys.js';
import { HclIdentityFactory } from '../factories/index.js';
import { HclConfigurationSchema, type HclExternalIdentityProvider } from '../schema/configuration.schema.js';

const API_URL = 'https://hcl.test';
const VALIDATE_URL = `${API_URL}/wcs/resources/store/41/loginidentity/oauth_validate`;

type ValidateCall = { body: { authorizationProvider: string; accessToken: string }; wcToken: string | null; wcTrustedToken: string | null };

/** Just enough of the WCS transaction service for external login. */
class FakeHcl {
  calls: ValidateCall[] = [];
  status = 200;

  reset() {
    this.calls = [];
    this.status = 200;
  }

  async handle(request: Request): Promise<Response> {
    if (request.method === 'POST' && request.url.split('?')[0] === VALIDATE_URL) {
      this.calls.push({
        body: (await request.json()) as ValidateCall['body'],
        wcToken: request.headers.get('WCToken'),
        wcTrustedToken: request.headers.get('WCTrustedToken'),
      });
      if (this.status !== 200) {
        return new Response(JSON.stringify({ errors: [{ errorMessage: 'invalid token' }] }), {
          status: this.status,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ WCToken: 'registered-wc', WCTrustedToken: 'registered-trusted', userId: '1001', personalizationID: 'p-1' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ message: `unexpected ${request.method} ${request.url}` }), { status: 404 });
  }
}

const hcl = new FakeHcl();
const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    const request = new Request(...args);
    return request.url.startsWith(API_URL) ? hcl.handle(request) : realFetch(...args);
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  hcl.reset();
});

function createHcl(providers: HclExternalIdentityProvider[], context: RequestContext) {
  const config = HclConfigurationSchema.parse({ apiUrl: API_URL, storeId: '41', externalIdentityProviders: providers });
  return new HclIdentityCapability(new NoOpCache(), context, config, new HclClient(config, context), new HclIdentityFactory(IdentitySchema));
}

runExternalLoginConformance({
  name: 'HCL Commerce',
  createCapability: (providers, context) => createHcl(providers, context),
});

describe('HCL Commerce external login', () => {
  const callbackUrl = 'https://shop.example/auth/callback/fake';
  let idp: FakeOidcProvider;
  let context: RequestContext;
  let provider: HclExternalIdentityProvider;

  beforeAll(async () => {
    idp = await FakeOidcProvider.start();
  });
  afterAll(async () => {
    await idp.close();
  });
  beforeEach(() => {
    context = createInitialRequestContext();
    provider = { key: 'fake', displayName: 'Fake', issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret };
  });

  async function login(identity: HclIdentityCapability) {
    const started = await identity.startExternalLogin({ provider: { key: 'fake' }, callbackUrl });
    assert(started.success);
    const callback = new URL(idp.approve(started.value.location));
    return identity.completeExternalLogin({
      provider: { key: 'fake' },
      callbackUrl,
      callbackParameters: Object.fromEntries(callback.searchParams),
    });
  }

  it('sends the ID token to oauth_validate under the HCL provider name and stores the session it returns', async () => {
    const completed = await login(createHcl([{ ...provider, authorizationProvider: 'AD' }], context));
    assert(completed.success);
    expect(completed.value).toMatchObject({ type: 'Registered', id: { userId: '1001' } });

    expect(hcl.calls).toHaveLength(1);
    expect(hcl.calls[0]?.body.authorizationProvider).toBe('AD');
    expect(hcl.calls[0]?.body.accessToken.split('.')).toHaveLength(3);

    expect(context.session[SESSION_KEY_WC_TOKEN]).toBe('registered-wc');
    expect(context.session[SESSION_KEY_WC_TRUSTED_TOKEN]).toBe('registered-trusted');
    expect(context.session[SESSION_KEY_USER_ID]).toBe('1001');
    expect(context.session[SESSION_KEY_IDENTITY_TYPE]).toBe('registered');
  });

  it('uses the provider key as the HCL provider name by default', async () => {
    await login(createHcl([provider], context));
    expect(hcl.calls[0]?.body.authorizationProvider).toBe('fake');
  });

  it('can send the access token instead of the ID token', async () => {
    await login(createHcl([{ ...provider, tokenType: 'access_token' }], context));
    expect(hcl.calls[0]?.body.accessToken).toBe('access-token');
  });

  it('sends the guest tokens so HCL Commerce can merge the guest cart itself', async () => {
    context.session[SESSION_KEY_WC_TOKEN] = 'guest-wc';
    context.session[SESSION_KEY_WC_TRUSTED_TOKEN] = 'guest-trusted';
    context.session[SESSION_KEY_IDENTITY_TYPE] = 'guest';
    await login(createHcl([provider], context));
    expect(hcl.calls[0]).toMatchObject({ wcToken: 'guest-wc', wcTrustedToken: 'guest-trusted' });
    expect(context.session[SESSION_KEY_WC_TOKEN]).toBe('registered-wc');
  });

  it('fails and keeps the guest session when HCL Commerce rejects the token', async () => {
    hcl.status = 401;
    context.session[SESSION_KEY_WC_TOKEN] = 'guest-wc';
    context.session[SESSION_KEY_IDENTITY_TYPE] = 'guest';
    const completed = await login(createHcl([provider], context));
    assert(!completed.success);
    expect(context.session[SESSION_KEY_WC_TOKEN]).toBe('guest-wc');
    expect(context.session[SESSION_KEY_IDENTITY_TYPE]).toBe('guest');
  });
});
