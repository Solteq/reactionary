import { NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { FakeOidcProvider, runExternalLoginConformance } from '@reactionary/oidc/testing';
import type { ExternalIdentityProvider } from '@reactionary/oidc';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoIdentityCapability } from '../capabilities/identity.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';

const BASE_URL = 'https://magento.test';
const ADMIN_KEY = 'admin-key';

type FakeCustomer = { id: number; email: string; firstname: string; lastname: string };

/** Just enough of Magento's REST and GraphQL for external login, kept in memory. */
class FakeMagento {
  customers: FakeCustomer[] = [];
  createdPasswords: string[] = [];
  mergeCalls: Array<{ source: string; authorization: string | null }> = [];
  failMerge = false;

  reset() {
    this.customers = [];
    this.createdPasswords = [];
    this.mergeCalls = [];
    this.failMerge = false;
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/rest(\/default)?/, '');
    const authorization = request.headers.get('authorization');
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (url.pathname === '/graphql') {
      const { variables } = (await request.json()) as { variables: { source: string } };
      this.mergeCalls.push({ source: variables.source, authorization });
      return this.failMerge ? json({ errors: [{ message: 'merge failed' }] }) : json({ data: { mergeCarts: { id: 'customer-cart' } } });
    }
    if (request.method === 'GET' && path === '/V1/customers/search') {
      const email = url.searchParams.get('searchCriteria[filterGroups][0][filters][0][value]');
      const items = this.customers.filter((customer) => customer.email === email);
      return json({ items, total_count: items.length });
    }
    if (request.method === 'POST' && path === '/V1/customers') {
      const body = (await request.json()) as { customer: Omit<FakeCustomer, 'id'>; password: string };
      const customer = { id: this.customers.length + 1, ...body.customer };
      this.customers.push(customer);
      this.createdPasswords.push(body.password);
      return json(customer, 200);
    }
    const tokenRoute = /^\/V1\/customers\/(\d+)\/token$/.exec(path);
    if (request.method === 'POST' && tokenRoute) {
      return authorization === `Bearer ${ADMIN_KEY}` ? json(`token-${tokenRoute[1]}`) : json({ message: 'denied' }, 401);
    }
    if (request.method === 'GET' && path === '/V1/customers/me') {
      const id = Number(/^Bearer token-(\d+)$/.exec(authorization ?? '')?.[1]);
      const customer = this.customers.find((candidate) => candidate.id === id);
      return customer ? json(customer) : json({ message: 'unauthorized' }, 401);
    }
    return json({ message: `unexpected ${request.method} ${path}` }, 404);
  }
}

const magento = new FakeMagento();
const realFetch = globalThis.fetch;

beforeAll(() => {
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    const request = new Request(...args);
    return request.url.startsWith(BASE_URL) ? magento.handle(request) : realFetch(...args);
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  magento.reset();
});

function createMagento(providers: ExternalIdentityProvider[], context: RequestContext) {
  const config = MagentoConfigurationSchema.parse({
    adminApiKey: ADMIN_KEY,
    baseUrl: BASE_URL,
    allCurrencies: ['EUR'],
    externalIdentityProviders: providers,
  });
  const client = new MagentoClient(config, context);
  return { identity: new MagentoIdentityCapability(config, new NoOpCache(), context, client), client };
}

runExternalLoginConformance({
  name: 'Magento',
  createCapability: (providers, context) => createMagento(providers, context).identity,
});

describe('Magento external login', () => {
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
    provider = { key: 'fake', displayName: 'Fake', issuer: idp.issuer, clientId: idp.clientId, clientSecret: idp.clientSecret };
  });

  async function login(identity: MagentoIdentityCapability, claims: Record<string, unknown> = {}) {
    const started = await identity.startExternalLogin({ provider: { key: 'fake' }, callbackUrl });
    assert(started.success);
    const callback = new URL(idp.approve(started.value.location, { claims }));
    return identity.completeExternalLogin({
      provider: { key: 'fake' },
      callbackUrl,
      callbackParameters: Object.fromEntries(callback.searchParams),
    });
  }

  it('creates the customer from the claims and signs them in with a token minted by the admin key', async () => {
    const { identity } = createMagento([provider], context);
    const completed = await login(identity, { email: 'grace@example.com', given_name: 'Grace', family_name: 'Hopper' });
    assert(completed.success);
    expect(completed.value).toMatchObject({ type: 'Registered', id: { userId: '1' } });
    expect(magento.customers).toEqual([{ id: 1, email: 'grace@example.com', firstname: 'Grace', lastname: 'Hopper' }]);
    // Nobody types this password, but it must satisfy Magento's character class policy.
    expect(magento.createdPasswords[0]).toMatch(/[A-Z]/);
    expect(magento.createdPasswords[0]).toMatch(/[a-z]/);
    expect(magento.createdPasswords[0]).toMatch(/[0-9]/);
    expect(magento.createdPasswords[0]).toMatch(/[^A-Za-z0-9]/);
  });

  it('signs in an existing customer with the same email instead of creating another', async () => {
    magento.customers.push({ id: 7, email: 'ada@example.com', firstname: 'Ada', lastname: 'Lovelace' });
    const { identity } = createMagento([provider], context);
    const completed = await login(identity);
    assert(completed.success);
    expect(completed.value).toMatchObject({ id: { userId: '7' } });
    expect(magento.customers).toHaveLength(1);
  });

  it('falls back to splitting the name claim, then to the defaults register uses', async () => {
    const { identity } = createMagento([provider], context);
    await login(identity, { email: 'a@example.com', given_name: undefined, family_name: undefined, name: 'Ada King Lovelace' });
    await login(createMagento([provider], createInitialRequestContext()).identity, {
      email: 'b@example.com',
      given_name: undefined,
      family_name: undefined,
      name: undefined,
    });
    expect(magento.customers.map((c) => [c.firstname, c.lastname])).toEqual([
      ['Ada', 'King Lovelace'],
      ['User', 'Account'],
    ]);
  });

  it('refuses an identity without an email address', async () => {
    const { identity } = createMagento([provider], context);
    const completed = await login(identity, { email: undefined });
    assert(!completed.success);
    expect(completed.error.type).toBe('InvalidInput');
    expect(magento.customers).toHaveLength(0);
  });

  it('merges the guest cart into the customer cart using the customer token, and forgets the guest cart id', async () => {
    const { identity, client } = createMagento([provider], context);
    await client.setActiveCartId('guest-cart-1');
    const completed = await login(identity);
    assert(completed.success);
    expect(magento.mergeCalls).toEqual([{ source: 'guest-cart-1', authorization: 'Bearer token-1' }]);
    expect(await client.getActiveCartId()).toBeNull();
  });

  it('still signs the customer in when the guest cart cannot be merged', async () => {
    magento.failMerge = true;
    const { identity, client } = createMagento([provider], context);
    await client.setActiveCartId('guest-cart-1');
    const completed = await login(identity);
    assert(completed.success);
    expect(await client.getActiveCartId()).toBeNull();
  });

  it('does not call GraphQL when there is no guest cart', async () => {
    const { identity } = createMagento([provider], context);
    await login(identity);
    expect(magento.mergeCalls).toEqual([]);
  });
});
