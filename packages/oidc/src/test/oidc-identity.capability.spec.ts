import {
  NoOpCache,
  createInitialRequestContext,
  success,
  type Identity,
  type IdentityConflictError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ExternalIdentityProviderSchema,
  OidcIdentityCapability,
  clearDiscoveryCache,
  codeChallenge,
  randomToken,
  refreshTokens,
  resolveMetadata,
  type ExchangeExternalIdentityInput,
  type ExternalIdentityProvider,
} from '../index.js';
import { FakeOidcProvider, runExternalLoginConformance } from '../testing/index.js';

/** The smallest possible backend: every verified identity becomes a registered user named by its subject. */
class TestBackendIdentityCapability extends OidcIdentityCapability {
  exchanged: ExchangeExternalIdentityInput[] = [];
  conflictFor: string | undefined;

  protected override async exchangeExternalIdentity(
    input: ExchangeExternalIdentityInput,
  ): Promise<Result<Identity, IdentityConflictError>> {
    this.exchanged.push(input);
    if (this.conflictFor && input.claims['email'] === this.conflictFor) {
      return { success: false, error: { type: 'IdentityConflict', message: 'exists' }, meta: { trace: '' } };
    }
    return success({ type: 'Registered', id: { userId: String(input.claims.sub) } });
  }

  override async getSelf() {
    return success(this.context.session.identityContext.identity);
  }
  override async login() {
    return success(this.context.session.identityContext.identity);
  }
  override async logout() {
    return success(this.context.session.identityContext.identity);
  }
  override async register() {
    return success(this.context.session.identityContext.identity);
  }
}

runExternalLoginConformance({
  name: 'test backend',
  createCapability: (providers, context) => new TestBackendIdentityCapability(new NoOpCache(), context, providers),
});

describe('OidcIdentityCapability', () => {
  const callbackUrl = 'https://shop.example/auth/callback/fake';
  let idp: FakeOidcProvider;
  let provider: ExternalIdentityProvider;
  let context: RequestContext;

  beforeAll(async () => {
    idp = await FakeOidcProvider.start();
  });
  afterAll(async () => {
    await idp.close();
  });
  beforeEach(() => {
    clearDiscoveryCache();
    context = createInitialRequestContext();
    provider = { key: 'fake', displayName: 'Fake', issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret };
  });

  function backend(providers: ExternalIdentityProvider[] = [provider]) {
    return new TestBackendIdentityCapability(new NoOpCache(), context, providers);
  }

  async function login(identity: TestBackendIdentityCapability, claims: Record<string, unknown> = {}) {
    const started = await identity.startExternalLogin({ provider: { key: provider.key }, callbackUrl });
    assert(started.success);
    const callback = new URL(idp.approve(started.value.location, { claims }));
    return identity.completeExternalLogin({
      provider: { key: provider.key },
      callbackUrl,
      callbackParameters: Object.fromEntries(callback.searchParams),
    });
  }

  it('sends the configured fixed authorize parameters and scopes', async () => {
    const identity = backend([{ ...provider, scopes: ['openid', 'email'], authorizationParams: { prompt: 'login', connection: 'apple' } }]);
    const started = await identity.startExternalLogin({ provider: { key: 'fake' }, callbackUrl });
    assert(started.success);
    const params = new URL(started.value.location).searchParams;
    expect(params.get('scope')).toBe('openid email');
    expect(params.get('prompt')).toBe('login');
    expect(params.get('connection')).toBe('apple');
  });

  it('hands the verified claims and tokens to the backend', async () => {
    const identity = backend();
    const completed = await login(identity, { sub: 'abc', email: 'grace@example.com' });
    assert(completed.success);
    expect(identity.exchanged).toHaveLength(1);
    expect(identity.exchanged[0]?.claims['email']).toBe('grace@example.com');
    expect(identity.exchanged[0]?.tokens.accessToken).toBe('access-token');
  });

  it('passes an IdentityConflict from the backend through and does not record an identity', async () => {
    const identity = backend();
    identity.conflictFor = 'ada@example.com';
    const completed = await login(identity);
    assert(!completed.success);
    expect(completed.error.type).toBe('IdentityConflict');
    expect(context.session.identityContext.identity.type).not.toBe('Registered');
  });

  it('accepts an unverified email only when the provider opts out of the check', async () => {
    const lenient = backend([{ ...provider, requireVerifiedEmail: false }]);
    const completed = await login(lenient, { email_verified: undefined });
    expect(completed.success).toBe(true);
  });

  it('works as a public client when no secret is configured', async () => {
    const publicClient: ExternalIdentityProvider = { ...provider };
    delete publicClient.clientSecret;
    const completed = await login(backend([publicClient]));
    expect(completed.success).toBe(true);
  });

  it('skips discovery when all endpoints are configured, trusting the configured issuer', async () => {
    const identity = backend([
      {
        ...provider,
        issuer: idp.issuer,
        authorizationEndpoint: `${idp.issuer}/authorize`,
        tokenEndpoint: `${idp.issuer}/token`,
        jwksUri: `${idp.issuer}/jwks`,
      },
    ]);
    const completed = await login(identity);
    expect(completed.success).toBe(true);
  });

  it('fails to start when the discovery document names a different issuer', async () => {
    const started = await backend([{ ...provider, issuer: `${idp.issuer}/` }]).startExternalLogin({
      provider: { key: 'fake' },
      callbackUrl,
    });
    assert(!started.success);
  });
});

describe('refreshTokens', () => {
  let idp: FakeOidcProvider;
  let provider: ExternalIdentityProvider;

  beforeAll(async () => {
    idp = await FakeOidcProvider.start();
    provider = { key: 'fake', displayName: 'Fake', issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret };
  });
  afterAll(async () => {
    await idp.close();
  });
  beforeEach(() => {
    clearDiscoveryCache();
    idp.failTokenEndpoint = false;
    idp.rotateRefreshToken = false;
  });

  it('gets a new access token and keeps the old refresh token when none is returned', async () => {
    const refreshed = await refreshTokens(provider, await resolveMetadata(provider), 'refresh-token');
    expect(refreshed.accessToken).toMatch(/^access-token-/);
    expect(refreshed.refreshToken).toBeUndefined();
    expect(refreshed.expiresIn).toBe(300);
  });

  it('returns a rotated refresh token', async () => {
    idp.rotateRefreshToken = true;
    const refreshed = await refreshTokens(provider, await resolveMetadata(provider), 'refresh-token');
    expect(refreshed.refreshToken).toBe('refresh-token');
  });

  it('fails when the identity provider refuses the refresh token', async () => {
    await expect(refreshTokens(provider, await resolveMetadata(provider), 'revoked')).rejects.toThrow(/refused the refresh token/);
  });
});

describe('ExternalIdentityProviderSchema', () => {
  const valid = { key: 'google', displayName: 'Google', issuer: 'https://accounts.google.com', clientId: 'id' };

  it('accepts a minimal https provider', () => {
    expect(ExternalIdentityProviderSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an http issuer except for localhost', () => {
    expect(ExternalIdentityProviderSchema.safeParse({ ...valid, issuer: 'http://idp.example' }).success).toBe(false);
    expect(ExternalIdentityProviderSchema.safeParse({ ...valid, issuer: 'http://localhost:9000' }).success).toBe(true);
  });

  it.each(['state', 'nonce', 'redirect_uri', 'client_id', 'code_challenge', 'scope', 'response_type'])(
    'rejects authorizationParams that set %s',
    (key) => {
      expect(ExternalIdentityProviderSchema.safeParse({ ...valid, authorizationParams: { [key]: 'x' } }).success).toBe(false);
    },
  );

  it('allows prompt and connection', () => {
    expect(ExternalIdentityProviderSchema.safeParse({ ...valid, authorizationParams: { prompt: 'login', connection: 'apple' } }).success).toBe(true);
  });
});

describe('pkce', () => {
  it('produces the RFC 7636 example challenge', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('produces unguessable URL-safe values', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
});
