import { createInitialRequestContext, type IdentityCapability, type RequestContext } from '@reactionary/core';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDiscoveryCache } from '../client/discovery.js';
import type { ExternalIdentityProvider } from '../schema/external-identity-provider.schema.js';
import { FakeOidcProvider } from './fake-idp.js';

export type ExternalLoginConformanceOptions = {
  /** Name of the backend, for the test titles. */
  name: string;
  /**
   * Builds the backend's identity capability with the given providers, set up so that a verified identity from
   * the fake provider can be exchanged for a Registered session.
   */
  createCapability: (providers: ExternalIdentityProvider[], context: RequestContext) => IdentityCapability;
};

const CALLBACK_URL = 'https://shop.example/auth/callback/fake';

/**
 * The scenarios every backend that uses the shared OpenID Connect client must pass, written against the public
 * IdentityCapability contract only, so the storefront can rely on identical behaviour.
 */
export function runExternalLoginConformance(options: ExternalLoginConformanceOptions) {
  describe(`External login conformance: ${options.name}`, () => {
    let idp: FakeOidcProvider;
    let provider: ExternalIdentityProvider;
    let context: RequestContext;
    let identity: IdentityCapability;

    beforeAll(async () => {
      idp = await FakeOidcProvider.start();
      provider = {
        key: 'fake',
        displayName: 'Fake IdP',
        brand: 'google',
        issuer: idp.issuer,
        clientId: idp.clientId,
        clientSecret: idp.clientSecret,
      };
    });

    afterAll(async () => {
      await idp.close();
    });

    beforeEach(() => {
      clearDiscoveryCache();
      idp.failTokenEndpoint = false;
      context = createInitialRequestContext();
      identity = options.createCapability([provider], context);
    });

    async function start(): Promise<string> {
      const started = await identity.startExternalLogin({ provider: { key: 'fake' }, callbackUrl: CALLBACK_URL });
      assert(started.success);
      return started.value.location;
    }

    function callbackParameters(callbackUrl: string): Record<string, string> {
      return Object.fromEntries(new URL(callbackUrl).searchParams);
    }

    it('offers password login and the configured provider, with its brand', async () => {
      const providers = await identity.listProviders({});
      assert(providers.success);
      expect(providers.value.map((p) => [p.identifier.key, p.flow, p.brand])).toEqual([
        ['password', 'credentials', 'email'],
        ['fake', 'redirect', 'google'],
      ]);
    });

    it('starts at the identity provider with PKCE and binds the login to the session', async () => {
      const location = new URL(await start());
      expect(location.origin).toBe(idp.issuer);
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
      expect(location.searchParams.get('redirect_uri')).toBe(CALLBACK_URL);
      expect(context.session.identityContext.pendingExternalLogin?.provider).toBe('fake');
    });

    it('completes a login and returns a registered identity', async () => {
      const callback = idp.approve(await start());
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: callbackParameters(callback),
      });
      assert(completed.success);
      expect(completed.value.type).toBe('Registered');
      expect(context.session.identityContext.identity.type).toBe('Registered');
      expect(context.session.identityContext.pendingExternalLogin).toBeUndefined();
    });

    it('rejects a callback whose state this session did not issue', async () => {
      const callback = idp.approve(await start());
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: { ...callbackParameters(callback), state: 'forged' },
      });
      assert(!completed.success);
      expect(completed.error.type).toBe('InvalidInput');
    });

    it('rejects a callback that is replayed', async () => {
      const callback = idp.approve(await start());
      const parameters = callbackParameters(callback);
      await identity.completeExternalLogin({ provider: { key: 'fake' }, callbackUrl: CALLBACK_URL, callbackParameters: parameters });
      const replay = await identity.completeExternalLogin({ provider: { key: 'fake' }, callbackUrl: CALLBACK_URL, callbackParameters: parameters });
      assert(!replay.success);
    });

    it('rejects a login the shopper abandoned at the identity provider', async () => {
      const callback = new URL(idp.approve(await start()));
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: { state: callback.searchParams.get('state') ?? '', error: 'access_denied' },
      });
      assert(!completed.success);
      expect(completed.error.type).toBe('InvalidInput');
    });

    it('rejects an unknown provider', async () => {
      const started = await identity.startExternalLogin({ provider: { key: 'nope' }, callbackUrl: CALLBACK_URL });
      assert(!started.success);
      expect(started.error.type).toBe('InvalidInput');
    });

    it.each(['signature', 'audience', 'issuer', 'nonce', 'expired'] as const)('rejects an ID token with a bad %s', async (tamper) => {
      const callback = idp.approve(await start(), { tamper });
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: callbackParameters(callback),
      });
      assert(!completed.success);
      expect(context.session.identityContext.identity.type).not.toBe('Registered');
    });

    it('rejects an unverified email', async () => {
      const callback = idp.approve(await start(), { claims: { email_verified: false } });
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: callbackParameters(callback),
      });
      assert(!completed.success);
    });

    it('fails when the identity provider refuses the authorization code', async () => {
      const callback = idp.approve(await start());
      idp.failTokenEndpoint = true;
      const completed = await identity.completeExternalLogin({
        provider: { key: 'fake' },
        callbackUrl: CALLBACK_URL,
        callbackParameters: callbackParameters(callback),
      });
      assert(!completed.success);
    });
  });
}
