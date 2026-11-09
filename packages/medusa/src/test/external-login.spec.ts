import { NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { MedusaIdentityCapability } from '../capabilities/identity.capability.js';
import { MedusaAPI } from '../core/client.js';
import { getMedusaTestConfiguration } from './test-utils.js';

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.signature`;
}

const callbackUrl = 'https://shop.example/auth/callback/oidc-auth0';
const provider = { key: 'oidc-auth0' };

type MedusaClient = Awaited<ReturnType<MedusaAPI['getClient']>>;

/** A MedusaAPI whose SDK client is replaced by a stub, so the HTTP flow can be exercised offline. */
class StubbedMedusaAPI extends MedusaAPI {
  constructor(context: RequestContext, stub: unknown) {
    super(getMedusaTestConfiguration(), context);
    // The stub only implements the SDK calls external login uses.
    this.client = Promise.resolve(stub as MedusaClient);
  }
}

function createStub(overrides: { callbackToken: string; createCustomer?: () => Promise<unknown> }) {
  return {
    auth: {
      listProviders: vi.fn(async () => ({
        providers: [
          { id: 'emailpass', identifier: 'emailpass', display_name: 'emailpass', flow: 'credentials' },
          { id: 'oidc-auth0', identifier: 'oidc', display_name: 'Auth0', flow: 'redirect' },
        ],
      })),
      login: vi.fn(async () => ({ location: 'https://tenant.auth0.com/authorize?client_id=x&state=abc123' })),
      callback: vi.fn(async () => overrides.callbackToken),
      refresh: vi.fn(async () => ({ token: jwt({ actor_id: 'cus_1' }) })),
    },
    client: { setToken: vi.fn(async () => undefined), clearToken: vi.fn(async () => undefined) },
    store: {
      customer: {
        create: vi.fn(overrides.createCustomer ?? (async () => ({ customer: { id: 'cus_1' } }))),
        retrieve: vi.fn(async () => ({ customer: { id: 'cus_1' } })),
      },
    },
  };
}

describe('Medusa external login', () => {
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
  });

  function capability(stub: ReturnType<typeof createStub>) {
    return new MedusaIdentityCapability(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      new StubbedMedusaAPI(reqCtx, stub),
    );
  }

  it('maps Medusa providers, keeping the flow', async () => {
    const result = await capability(createStub({ callbackToken: '' })).listProviders({});
    assert(result.success);
    expect(result.value.map((p) => [p.identifier.key, p.displayName, p.flow])).toEqual([
      ['emailpass', 'emailpass', 'credentials'],
      ['oidc-auth0', 'Auth0', 'redirect'],
    ]);
  });

  it('gives each provider a brand for the storefront icon', async () => {
    const stub = createStub({ callbackToken: '' });
    stub.auth.listProviders.mockResolvedValue({
      providers: [
        { id: 'emailpass', identifier: 'emailpass', display_name: 'Email', flow: 'credentials' },
        { id: 'oidc-auth0-google-oauth2', identifier: 'oidc', display_name: 'Google', flow: 'redirect' },
        { id: 'oidc-auth0-windowslive', identifier: 'oidc', display_name: 'Microsoft', flow: 'redirect' },
        { id: 'oidc-auth0-username-password-authentication', identifier: 'oidc', display_name: 'Email', flow: 'redirect' },
        { id: 'oidc-corp', identifier: 'oidc', display_name: 'Corporate', flow: 'redirect' },
      ],
    });
    const config = { ...getMedusaTestConfiguration(), identityProviderBrands: { 'oidc-corp': 'microsoft' } };
    const identity = new MedusaIdentityCapability(config, new NoOpCache(), reqCtx, new StubbedMedusaAPI(reqCtx, stub));
    const result = await identity.listProviders({});
    assert(result.success);
    expect(result.value.map((p) => [p.identifier.key, p.brand])).toEqual([
      ['emailpass', 'email'],
      ['oidc-auth0-google-oauth2', 'google'],
      ['oidc-auth0-windowslive', 'microsoft'],
      ['oidc-auth0-username-password-authentication', 'email'],
      ['oidc-corp', 'microsoft'],
    ]);
  });

  it('leaves the brand off when nothing matches', async () => {
    const stub = createStub({ callbackToken: '' });
    stub.auth.listProviders.mockResolvedValue({
      providers: [{ id: 'oidc-acme', identifier: 'oidc', display_name: 'Acme', flow: 'redirect' }],
    });
    const result = await capability(stub).listProviders({});
    assert(result.success);
    expect(result.value[0]).not.toHaveProperty('brand');
  });

  it('starts a login and binds the Medusa state to the session', async () => {
    const stub = createStub({ callbackToken: '' });
    const result = await capability(stub).startExternalLogin({ provider, callbackUrl });
    assert(result.success);
    expect(stub.auth.login).toHaveBeenCalledWith('customer', 'oidc-auth0', { callback_url: callbackUrl });
    expect(reqCtx.session.identityContext.pendingExternalLogin?.state).toBe('abc123');
  });

  it('logs in an existing customer without creating one', async () => {
    const stub = createStub({ callbackToken: jwt({ actor_id: 'cus_1' }) });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    const result = await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'abc123' } });
    assert(result.success);
    expect(result.value).toMatchObject({ type: 'Registered', id: { userId: 'cus_1' } });
    expect(stub.store.customer.create).not.toHaveBeenCalled();
    expect(stub.auth.refresh).not.toHaveBeenCalled();
    expect(result.value).toMatchObject({ externalLogin: { isNewCustomer: false, profile: {} } });
    expect(reqCtx.session.identityContext.identity).toEqual({ type: 'Registered', id: { userId: 'cus_1' } });
  });

  it('creates the customer on first login, then refreshes the token', async () => {
    const stub = createStub({
      callbackToken: jwt({ actor_id: '', user_metadata: { email: 'a@b.test', given_name: 'Ada', family_name: 'Lovelace' } }),
    });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    const result = await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'abc123' } });
    assert(result.success);
    expect(stub.store.customer.create).toHaveBeenCalledWith({ email: 'a@b.test', first_name: 'Ada', last_name: 'Lovelace' });
    expect(stub.auth.refresh).toHaveBeenCalledOnce();
    expect(result.value).toMatchObject({ externalLogin: { isNewCustomer: true, profile: { email: 'a@b.test', firstName: 'Ada', lastName: 'Lovelace' } } });
  });

  it('reports the phone and a complete address of a new customer for the profile', async () => {
    const stub = createStub({
      callbackToken: jwt({
        actor_id: '',
        user_metadata: {
          email: 'a@b.test',
          given_name: 'Ada',
          family_name: 'Lovelace',
          phone_number: '+4512345678',
          address: { street_address: 'Main Street 1', locality: 'Copenhagen', postal_code: '1000', country: 'DK' },
        },
      }),
    });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    const result = await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'abc123' } });
    assert(result.success);
    expect(result.value).toMatchObject({
      externalLogin: { isNewCustomer: true, profile: { phone: '+4512345678', billingAddress: { city: 'Copenhagen', countryCode: 'DK' } } },
    });
  });

  it('falls back to splitting the name claim', async () => {
    const stub = createStub({ callbackToken: jwt({ actor_id: '', user_metadata: { email: 'a@b.test', name: 'Ada King Lovelace' } }) });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'abc123' } });
    expect(stub.store.customer.create).toHaveBeenCalledWith({ email: 'a@b.test', first_name: 'Ada', last_name: 'King Lovelace' });
  });

  it('reports an IdentityConflict and drops the token when the email already has an account', async () => {
    const stub = createStub({
      callbackToken: jwt({ actor_id: '', user_metadata: { email: 'a@b.test' } }),
      createCustomer: async () => {
        throw new Error('Customer with this email already has an account');
      },
    });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    const result = await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'abc123' } });
    assert(!result.success);
    expect(result.error.type).toBe('IdentityConflict');
    expect(stub.client.clearToken).toHaveBeenCalled();
    expect(reqCtx.session.identityContext.identity.type).toBe('Anonymous');
  });

  it('rejects a callback with a state the session did not issue', async () => {
    const stub = createStub({ callbackToken: jwt({ actor_id: 'cus_1' }) });
    const identity = capability(stub);
    await identity.startExternalLogin({ provider, callbackUrl });
    const result = await identity.completeExternalLogin({ provider, callbackUrl, callbackParameters: { code: 'c', state: 'forged' } });
    assert(!result.success);
    expect(stub.auth.callback).not.toHaveBeenCalled();
  });
});
