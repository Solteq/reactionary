import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CartPaginatedSearchResultSchema,
  CartSchema,
  createInitialRequestContext,
  MemoryCache,
  NoOpCache,
  type Cache,
  type Identity,
  type RequestContext,
} from '@reactionary/core';
import { MedusaCartCapability } from '../capabilities/cart.capability.js';
import { MedusaAPI, SESSION_KEY } from '../core/client.js';
import { MedusaCartFactory } from '../factories/cart/cart.factory.js';
import { MedusaCartIdentifierSchema } from '../schema/medusa.schema.js';
import { MedusaConfigurationSchema, type MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaSession } from '../schema/medusa.schema.js';

const CART_OWNERSHIP_PLUGIN = '@solteq-excom/medusa-cart-ownership';

/**
 * Offline tests for listing carts through the optional cart-ownership
 * plugin's GET /store/customers/me/carts, against a local stub standing in
 * for both the Medusa store and admin API:
 * - GET /admin/plugins answers from `stub.plugins` ('error' => 500)
 * - GET /store/customers/me/carts behaves per `stub.ownedCartsMode`
 * - GET /store/carts/:id serves any cart (the session fallback path)
 * Every hit is recorded so tests can assert which routes were (not) used.
 */
interface StubState {
  plugins: string[] | 'error';
  ownedCartsMode: 'ok' | 'missing' | 'unauthorized' | 'boom';
  ownedCarts: object[];
  ownedCartsCount: number;
  adminPluginRequests: number;
  ownedCartsRequests: string[];
  cartRetrieveRequests: string[];
}

let server: Server;
let config: MedusaConfiguration;
let stub: StubState;

function resetStub() {
  stub = {
    plugins: [CART_OWNERSHIP_PLUGIN],
    ownedCartsMode: 'ok',
    ownedCarts: [],
    ownedCartsCount: 0,
    adminPluginRequests: 0,
    ownedCartsRequests: [],
    cartRetrieveRequests: [],
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url || '';
    res.setHeader('Content-Type', 'application/json');

    if (url.startsWith('/admin/plugins')) {
      stub.adminPluginRequests += 1;
      if (stub.plugins === 'error') {
        res.statusCode = 500;
        res.end(JSON.stringify({ type: 'unknown_error', message: 'admin boom' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ plugins: stub.plugins.map((name) => ({ name })) }));
      return;
    }

    if (url.startsWith('/store/customers/me/carts')) {
      stub.ownedCartsRequests.push(url);
      if (stub.ownedCartsMode === 'missing') {
        res.statusCode = 404;
        res.end(JSON.stringify({ type: 'not_found', message: 'Not found' }));
        return;
      }
      if (stub.ownedCartsMode === 'unauthorized') {
        res.statusCode = 401;
        res.end(JSON.stringify({ type: 'unauthorized', message: 'Unauthorized' }));
        return;
      }
      if (stub.ownedCartsMode === 'boom') {
        res.statusCode = 500;
        res.end(JSON.stringify({ type: 'unknown_error', message: 'boom' }));
        return;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          carts: stub.ownedCarts,
          count: stub.ownedCartsCount,
          offset: 0,
          limit: stub.ownedCarts.length,
        }),
      );
      return;
    }

    const retrieveMatch = url.match(/^\/store\/carts\/([^/?]+)/);
    if (retrieveMatch) {
      const cartId = retrieveMatch[1];
      stub.cartRetrieveRequests.push(cartId);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          cart: {
            id: cartId,
            region_id: 'reg_1',
            currency_code: 'dkk',
            updated_at: '2026-10-01T00:00:00.000Z',
            metadata: { name: `Session ${cartId}` },
            items: [],
          },
        }),
      );
      return;
    }

    if (url.startsWith('/store/regions')) {
      res.statusCode = 200;
      res.end(JSON.stringify({ regions: [{ id: 'reg_1', name: 'Denmark', currency_code: 'dkk' }] }));
      return;
    }

    if (url.startsWith('/store/carts') && req.method === 'POST') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          cart: { id: 'cart_new', region_id: 'reg_1', currency_code: 'dkk', items: [] },
        }),
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ type: 'not_found', message: `No stub for ${url}` }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  config = MedusaConfigurationSchema.parse({
    publishable_key: 'pk_test',
    adminApiKey: 'sk_test',
    apiUrl: `http://127.0.0.1:${port}`,
    defaultCurrency: 'DKK',
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe('Medusa listCarts via the cart-ownership plugin', () => {
  let context: RequestContext;
  let capability: MedusaCartCapability;

  function buildCapability(cache: Cache = new NoOpCache()) {
    context = createInitialRequestContext();
    const medusaApi = new MedusaAPI(config, context);
    const factory = new MedusaCartFactory(
      CartSchema,
      MedusaCartIdentifierSchema,
      CartPaginatedSearchResultSchema,
    );
    capability = new MedusaCartCapability(config, cache, context, medusaApi, factory);
  }

  function seedSession(session: Partial<MedusaSession>) {
    context.session[SESSION_KEY] = session;
  }

  function readSession(): Partial<MedusaSession> {
    return context.session[SESSION_KEY] as Partial<MedusaSession>;
  }

  function setIdentity(identity: Identity) {
    context.session.identityContext.identity = identity;
  }

  function listCarts(pageNumber = 1, pageSize = 10, company?: { taxIdentifier: string }) {
    return capability.listCarts({
      search: {
        ...(company ? { company } : {}),
        paginationOptions: { pageNumber, pageSize },
      },
    });
  }

  beforeEach(() => {
    resetStub();
    buildCapability();
  });

  it('lists a registered customer\'s carts from the endpoint, ignoring the session', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_sess' }] } });
    stub.ownedCarts = [
      {
        id: 'cart_a',
        updated_at: '2026-10-08T12:00:00.000Z',
        metadata: { name: 'Cart A' },
        items: [{ id: 'li_1' }],
        customer: { id: 'cus_1' },
      },
      {
        id: 'cart_b',
        updated_at: '2026-10-07T12:00:00.000Z',
        metadata: {},
        items: [],
        customer: { id: 'cus_1' },
      },
    ];
    stub.ownedCartsCount = 2;

    const result = await listCarts();

    assert(result.success, 'expected the endpoint listing to succeed');
    expect(result.value.totalCount).toBe(2);
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_a', 'cart_b']);
    expect(result.value.items[0].name).toBe('Cart A');
    expect(result.value.items[0].numItems).toBe(1);
    expect(result.value.items[0].user.userId).toBe('cus_1');
    // The session-tracked cart is not consulted at all.
    expect(stub.cartRetrieveRequests).toEqual([]);
  });

  it('maps pagination onto limit/offset and requests the configured fields and order', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.ownedCarts = [
      { id: 'cart_c', updated_at: '2026-10-06T12:00:00.000Z', metadata: {}, items: [] },
      { id: 'cart_d', updated_at: '2026-10-05T12:00:00.000Z', metadata: {}, items: [] },
    ];
    stub.ownedCartsCount = 5;

    const result = await listCarts(2, 2);

    assert(result.success, 'expected the endpoint listing to succeed');
    expect(stub.ownedCartsRequests).toHaveLength(1);
    const query = new URL(stub.ownedCartsRequests[0], config.apiUrl).searchParams;
    expect(query.get('limit')).toBe('2');
    expect(query.get('offset')).toBe('2');
    expect(query.get('order')).toBe('-updated_at');
    expect(query.get('fields')).toContain('customer.id');
    expect(result.value.pageNumber).toBe(2);
    expect(result.value.pageSize).toBe(2);
    expect(result.value.totalCount).toBe(5);
    expect(result.value.totalPages).toBe(3);
  });

  it('uses the session list when the backend does not have the plugin', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.plugins = ['some-other-plugin'];
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    assert(result.success, 'expected the session listing to succeed');
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_live']);
    expect(stub.ownedCartsRequests).toEqual([]);
    expect(stub.cartRetrieveRequests).toEqual(['cart_live']);
  });

  it('treats a failing plugin listing as "plugin absent" instead of failing', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.plugins = 'error';
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    assert(result.success, 'expected the session listing to succeed');
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_live']);
    expect(stub.ownedCartsRequests).toEqual([]);
  });

  it('caches the plugin detection in the reactionary cache', async () => {
    buildCapability(new MemoryCache());
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.ownedCarts = [];
    stub.ownedCartsCount = 0;

    await listCarts();
    await listCarts();

    expect(stub.adminPluginRequests).toBe(1);
    expect(stub.ownedCartsRequests).toHaveLength(2);
  });

  it('falls back to the session list when the route 404s (plugin configured but not built)', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.ownedCartsMode = 'missing';
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    assert(result.success, 'expected the fallback listing to succeed');
    expect(result.value.totalCount).toBe(1);
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_live']);
    expect(stub.ownedCartsRequests).toHaveLength(1);
    expect(stub.cartRetrieveRequests).toEqual(['cart_live']);
  });

  it('falls back to the session list on 401', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.ownedCartsMode = 'unauthorized';
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    assert(result.success, 'expected the fallback listing to succeed');
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_live']);
  });

  it('propagates other endpoint errors instead of masking them with session data', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    stub.ownedCartsMode = 'boom';
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    // The @Reactionary decorator surfaces the thrown provider error as a
    // Generic error result; the point is that the session list is NOT used
    // to answer instead.
    expect(result.success).toBe(false);
    expect(stub.cartRetrieveRequests).toEqual([]);
  });

  it('never consults the endpoint for an anonymous session', async () => {
    seedSession({ allOwnedCarts: { _me: [{ key: 'cart_live' }] } });

    const result = await listCarts();

    assert(result.success, 'expected the session listing to succeed');
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_live']);
    expect(stub.adminPluginRequests).toBe(0);
    expect(stub.ownedCartsRequests).toEqual([]);
  });

  it('never consults the endpoint when a company is set', async () => {
    setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
    seedSession({ allOwnedCarts: { acme: [{ key: 'cart_b2b' }] } });

    const result = await listCarts(1, 10, { taxIdentifier: 'acme' });

    assert(result.success, 'expected the session listing to succeed');
    expect(result.value.items.map((item) => item.identifier.key)).toEqual(['cart_b2b']);
    expect(stub.adminPluginRequests).toBe(0);
    expect(stub.ownedCartsRequests).toEqual([]);
  });

  describe('createCart session bookkeeping', () => {
    it('skips the owned-carts session entry for a registered customer when the plugin is active', async () => {
      setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });

      const result = await capability.createCart({ name: 'My Cart' });

      expect(result.success).toBe(true);
      expect(readSession().allOwnedCarts?.['_me']).toBeUndefined();
      expect(readSession().activeCartId?.key).toBe('cart_new');
    });

    it('still tracks the cart in the session for an anonymous customer', async () => {
      const result = await capability.createCart({ name: 'My Cart' });

      expect(result.success).toBe(true);
      expect(readSession().allOwnedCarts?.['_me']?.map((c) => c.key)).toEqual(['cart_new']);
      expect(readSession().activeCartId?.key).toBe('cart_new');
    });

    it('still tracks the cart in the session when the backend lacks the plugin', async () => {
      setIdentity({ type: 'Registered', id: { userId: 'cus_1' } });
      stub.plugins = [];

      const result = await capability.createCart({ name: 'My Cart' });

      expect(result.success).toBe(true);
      expect(readSession().allOwnedCarts?.['_me']?.map((c) => c.key)).toEqual(['cart_new']);
    });
  });
});
