import { IdentitySchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { FakeOidcProvider, runExternalLoginConformance } from '@reactionary/oidc/testing';
import type { ExternalIdentityProvider } from '@reactionary/oidc';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercetoolsIdentityCapability } from '../capabilities/identity.capability.js';
import { CommercetoolsAPI, PROVIDER_SESSION_KEY } from '../core/client.js';
import { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';
import { CommercetoolsConfigurationSchema } from '../schema/configuration.schema.js';

const AUTH_URL = 'https://auth.test';
const API_URL = 'https://api.test';
const PROJECT = 'test-project';

type FakeCustomer = { id: string; email: string; externalId?: string; authenticationMode?: string; anonymousId?: string };
type FakeCart = { id: string; version: number; anonymousId?: string; customerId?: string; cartState: string };

/** Just enough of the commercetools auth and HTTP APIs for external login, kept in memory. */
class FakeCommercetools {
  customers: FakeCustomer[] = [];
  carts: FakeCart[] = [];
  createdBodies: Array<Record<string, unknown>> = [];
  meAuthorizations: Array<string | null> = [];
  guestTokensIssued = 0;
  /** Guest sessions started for a shopper (the admin client uses the same route without a query string). */
  guestSessionsStarted = 0;
  introspectCalls = 0;

  reset() {
    this.customers = [];
    this.carts = [];
    this.createdBodies = [];
    this.meAuthorizations = [];
    this.guestTokensIssued = 0;
    this.guestSessionsStarted = 0;
    this.introspectCalls = 0;
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (url.origin === AUTH_URL) {
      if (url.pathname === `/oauth/${PROJECT}/anonymous/token`) {
        this.guestTokensIssued += 1;
        if (url.searchParams.has('grant_type')) this.guestSessionsStarted += 1;
        return json({
          access_token: `guest-token-${this.guestTokensIssued}`,
          refresh_token: `guest-refresh-${this.guestTokensIssued}`,
          expires_in: 172800,
          scope: `anonymous_id:guest-1 manage_my_orders:${PROJECT}`,
        });
      }
      if (url.pathname === '/oauth/introspect') {
        this.introspectCalls += 1;
        return json({ active: true, scope: `anonymous_id:guest-1 manage_my_orders:${PROJECT}` });
      }
      return json({ message: `unexpected auth ${url.pathname}` }, 404);
    }

    const path = url.pathname.replace(`/${PROJECT}`, '');
    const where = url.searchParams.get('where') ?? '';
    if (request.method === 'GET' && path === '/customers') {
      const results = where.startsWith('externalId')
        ? this.customers.filter((c) => c.externalId === url.searchParams.get('var.e'))
        : this.customers.filter((c) => [url.searchParams.get('var.a'), url.searchParams.get('var.b')].includes(c.email));
      return json({ results, count: results.length, total: results.length, offset: 0, limit: 1 });
    }
    if (request.method === 'POST' && path === '/customers') {
      const body = (await request.json()) as Omit<FakeCustomer, 'id'>;
      this.createdBodies.push(body);
      if (this.customers.some((c) => c.email.toLowerCase() === body.email.toLowerCase())) {
        return json({ statusCode: 400, message: 'duplicate', errors: [{ code: 'DuplicateField', field: 'email' }] }, 400);
      }
      const customer = { id: `customer-${this.customers.length + 1}`, ...body };
      this.customers.push(customer);
      return json({ customer }, 201);
    }
    if (request.method === 'GET' && path === '/carts') {
      const results = this.carts.filter((c) => c.anonymousId === url.searchParams.get('var.a') && c.cartState === 'Active');
      return json({ results, count: results.length, total: results.length, offset: 0, limit: 20 });
    }
    const cartRoute = /^\/carts\/([^/]+)$/.exec(path);
    if (request.method === 'POST' && cartRoute) {
      const cart = this.carts.find((c) => c.id === cartRoute[1]);
      const body = (await request.json()) as { actions: Array<{ action: string; customerId: string }> };
      if (!cart) return json({ message: 'not found' }, 404);
      for (const action of body.actions) {
        if (action.action === 'setCustomerId') cart.customerId = action.customerId;
      }
      cart.version += 1;
      return json(cart);
    }
    if (request.method === 'GET' && path === '/me') {
      this.meAuthorizations.push(request.headers.get('authorization'));
      return json({ id: 'me' });
    }
    return json({ message: `unexpected ${request.method} ${path}` }, 404);
  }
}

const commercetools = new FakeCommercetools();
const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    const request = new Request(...args);
    return request.url.startsWith(AUTH_URL) || request.url.startsWith(API_URL)
      ? commercetools.handle(request)
      : realFetch(...args);
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  commercetools.reset();
});

function createCommercetools(providers: ExternalIdentityProvider[], context: RequestContext) {
  const config = CommercetoolsConfigurationSchema.parse({
    projectKey: PROJECT,
    authUrl: AUTH_URL,
    apiUrl: API_URL,
    clientId: 'client',
    clientSecret: 'secret',
    externalIdentityProviders: providers,
  });
  const api = new CommercetoolsAPI(config, context);
  return {
    api,
    identity: new CommercetoolsIdentityCapability(config, new NoOpCache(), context, api, new CommercetoolsIdentityFactory(IdentitySchema)),
  };
}

runExternalLoginConformance({
  name: 'commercetools',
  createCapability: (providers, context) => createCommercetools(providers, context).identity,
});

describe('commercetools external login', () => {
  const callbackUrl = 'https://shop.example/auth/callback/fake';
  let idp: FakeOidcProvider;
  let context: RequestContext;
  let provider: ExternalIdentityProvider;

  beforeAll(async () => {
    idp = await FakeOidcProvider.start();
  });
  afterAll(async () => {
    await idp.close();
  });
  beforeEach(() => {
    context = createInitialRequestContext();
    idp.failTokenEndpoint = false;
    idp.omitAccessToken = false;
    idp.refreshCalls = 0;
    provider = { key: 'fake', displayName: 'Fake', issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret };
  });

  async function login(identity: CommercetoolsIdentityCapability, claims: Record<string, unknown> = {}) {
    const started = await identity.startExternalLogin({ provider: { key: 'fake' }, callbackUrl });
    assert(started.success);
    const callback = new URL(idp.approve(started.value.location, { claims }));
    return identity.completeExternalLogin({
      provider: { key: 'fake' },
      callbackUrl,
      callbackParameters: Object.fromEntries(callback.searchParams),
    });
  }

  const session = () => context.session[PROVIDER_SESSION_KEY] as Record<string, unknown>;

  it('creates an ExternalAuth customer keyed by issuer and subject, with the verified email and the guest id', async () => {
    const { api, identity } = createCommercetools([provider], context);
    await api.getClient(); // become a guest first
    const completed = await login(identity, { sub: 'abc', email: 'grace@example.com', given_name: 'Grace', family_name: 'Hopper' });
    assert(completed.success);
    expect(completed.value).toMatchObject({ type: 'Registered', id: { userId: 'customer-1' } });
    expect(commercetools.createdBodies[0]).toMatchObject({
      email: 'grace@example.com',
      externalId: `${idp.issuer}|abc`,
      authenticationMode: 'ExternalAuth',
      isEmailVerified: true,
      firstName: 'Grace',
      lastName: 'Hopper',
      anonymousId: 'guest-1',
    });
    expect(session()).toMatchObject({ tokenSource: 'external', externalProvider: 'fake', customerId: 'customer-1', token: 'access-token' });
  });

  it('reports the phone of a new customer for the profile, and uses the name claim when given and family name are missing', async () => {
    const { identity } = createCommercetools([provider], context);
    const completed = await login(identity, { email: 'grace@example.com', given_name: undefined, family_name: undefined, name: 'Grace Hopper', phone_number: '+4512345678' });
    assert(completed.success);
    assert(completed.value.type === 'Registered');
    expect(completed.value.externalLogin).toMatchObject({ isNewCustomer: true, profile: { phone: '+4512345678', firstName: 'Grace', lastName: 'Hopper' } });
    expect(commercetools.createdBodies[0]).toMatchObject({ firstName: 'Grace', lastName: 'Hopper' });
    expect(context.session.identityContext.identity).toEqual({ type: 'Registered', id: { userId: 'customer-1' } });
  });

  it('stores an assumed email verification and reads the address of an Azure B2C emails array', async () => {
    const { identity } = createCommercetools([{ ...provider, assumeEmailVerified: true }], context);
    const completed = await login(identity, { email: undefined, emails: ['grace@example.com'], email_verified: undefined });
    assert(completed.success);
    assert(completed.value.type === 'Registered');
    expect(commercetools.createdBodies[0]).toMatchObject({ email: 'grace@example.com', isEmailVerified: true });
    expect(completed.value.externalLogin?.profile).toMatchObject({ email: 'grace@example.com', emailVerified: true });
  });

  it('does not mark the email verified when the provider opted out of the check and said nothing', async () => {
    const { identity } = createCommercetools([{ ...provider, requireVerifiedEmail: false }], context);
    const completed = await login(identity, { email: 'grace@example.com', email_verified: undefined });
    assert(completed.success);
    assert(completed.value.type === 'Registered');
    expect(commercetools.createdBodies[0]).toMatchObject({ isEmailVerified: false });
    expect(completed.value.externalLogin?.profile.emailVerified).toBeUndefined();
  });

  it('reuses the customer that already has this externalId and moves the guest cart to it', async () => {
    commercetools.customers.push({ id: 'customer-9', email: 'ada@example.com', externalId: `${idp.issuer}|user-1` });
    commercetools.carts.push({ id: 'cart-1', version: 1, anonymousId: 'guest-1', cartState: 'Active' });
    const { api, identity } = createCommercetools([provider], context);
    await api.getClient();
    const completed = await login(identity);
    assert(completed.success);
    expect(completed.value).toMatchObject({ id: { userId: 'customer-9' }, externalLogin: { isNewCustomer: false, profile: {} } });
    expect(commercetools.customers).toHaveLength(1);
    expect(commercetools.carts[0]?.customerId).toBe('customer-9');
  });

  it('reports a customer with the same email but another externalId as an IdentityConflict', async () => {
    commercetools.customers.push({ id: 'customer-2', email: 'ada@example.com', authenticationMode: 'Password' });
    const { identity } = createCommercetools([provider], context);
    const completed = await login(identity);
    assert(!completed.success);
    expect(completed.error.type).toBe('IdentityConflict');
    expect(commercetools.createdBodies).toHaveLength(0);
    expect(session()?.['tokenSource']).toBeUndefined();
  });

  it('reports a case-only email clash that the lookup missed as an IdentityConflict', async () => {
    commercetools.customers.push({ id: 'customer-2', email: 'Ada@Example.com' });
    const { identity } = createCommercetools([provider], context);
    const completed = await login(identity, { email: 'ADA@example.com' });
    assert(!completed.success);
    expect(completed.error.type).toBe('IdentityConflict');
  });

  it('needs the identity provider to return an access token', async () => {
    idp.omitAccessToken = true;
    const { identity } = createCommercetools([provider], context);
    const completed = await login(identity);
    assert(!completed.success);
    expect(completed.error.type).toBe('InvalidInput');
    expect(commercetools.customers).toHaveLength(0);
  });

  it('calls commercetools with the identity provider access token', async () => {
    const { api, identity } = createCommercetools([provider], context);
    await login(identity);
    await (await api.getClient()).withProjectKey({ projectKey: PROJECT }).me().get().execute();
    expect(commercetools.meAuthorizations).toEqual(['Bearer access-token']);
  });

  it('a later request rebuilds the client from the session and still uses the external token', async () => {
    const first = createCommercetools([provider], context);
    await login(first.identity);
    const later = createCommercetools([provider], context); // a new request: new API object, same session
    await (await later.api.getClient()).withProjectKey({ projectKey: PROJECT }).me().get().execute();
    expect(commercetools.meAuthorizations).toEqual(['Bearer access-token']);
    expect(commercetools.guestSessionsStarted).toBe(0);
  });

  it('refreshes an expired access token through the identity provider', async () => {
    const { api, identity } = createCommercetools([provider], context);
    await login(identity);
    session()['expirationTime'] = Date.now() - 1000;
    await (await api.getClient()).withProjectKey({ projectKey: PROJECT }).me().get().execute();
    expect(idp.refreshCalls).toBe(1);
    expect(commercetools.meAuthorizations).toEqual(['Bearer access-token-2']);
    expect(session()['refreshToken']).toBe('refresh-token');
  });

  it('treats the shopper as signed out when the identity provider refuses the refresh', async () => {
    const { api, identity } = createCommercetools([provider], context);
    await login(identity);
    session()['expirationTime'] = Date.now() - 1000;
    idp.failTokenEndpoint = true;
    const self = await identity.getSelf({});
    assert(self.success);
    expect(self.value.type).toBe('Anonymous');
    expect(session()['tokenSource']).toBeUndefined();
    await expect(api.getClient()).resolves.toBeDefined();
  });

  it('reports the stored customer for an external session without asking commercetools to introspect', async () => {
    const { identity } = createCommercetools([provider], context);
    await login(identity);
    const self = await identity.getSelf({});
    assert(self.success);
    expect(self.value).toMatchObject({ type: 'Registered', id: { userId: 'customer-1' } });
    expect(commercetools.introspectCalls).toBe(0);
  });

  it('logout clears the external session and the next client is a guest again', async () => {
    const { api, identity } = createCommercetools([provider], context);
    await login(identity);
    await identity.logout({});
    expect(session()).toMatchObject({ token: '', expirationTime: 0 });
    expect(session()['tokenSource']).toBeUndefined();
    expect(session()['customerId']).toBeUndefined();
    await api.getClient();
    expect(commercetools.guestSessionsStarted).toBe(1);
  });
});
