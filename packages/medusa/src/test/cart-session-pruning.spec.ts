import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CartPaginatedSearchResultSchema,
  CartSchema,
  createInitialRequestContext,
  NoOpCache,
  type RequestContext,
} from '@reactionary/core';
import { MedusaCartCapability } from '../capabilities/cart.capability.js';
import { MedusaAPI, SESSION_KEY } from '../core/client.js';
import { MedusaCartFactory } from '../factories/cart/cart.factory.js';
import { MedusaCartIdentifierSchema } from '../schema/medusa.schema.js';
import { MedusaConfigurationSchema, type MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaSession } from '../schema/medusa.schema.js';

/**
 * Offline tests for session bookkeeping around deleted/stale carts, against a
 * local stub standing in for the Medusa store API:
 * - carts whose id contains "gone" are deleted upstream (404)
 * - carts whose id contains "boom" fail with a server error (500)
 * - every other cart exists
 */
let server: Server;
let config: MedusaConfiguration;

beforeAll(async () => {
  server = createServer((req, res) => {
    const match = req.url?.match(/^\/store\/carts\/([^/?]+)/);
    const cartId = match?.[1] || '';
    res.setHeader('Content-Type', 'application/json');
    if (cartId.includes('gone')) {
      res.statusCode = 404;
      res.end(JSON.stringify({ type: 'not_found', message: `Cart ${cartId} was not found` }));
      return;
    }
    if (cartId.includes('boom')) {
      res.statusCode = 500;
      res.end(JSON.stringify({ type: 'unknown_error', message: 'boom' }));
      return;
    }
    res.statusCode = 200;
    res.end(
      JSON.stringify({ cart: { id: cartId, region_id: 'reg_1', currency_code: 'eur', items: [] } }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  config = MedusaConfigurationSchema.parse({
    publishable_key: 'pk_test',
    adminApiKey: 'sk_test',
    apiUrl: `http://127.0.0.1:${port}`,
    defaultCurrency: 'EUR',
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe('Medusa cart session pruning', () => {
  let context: RequestContext;
  let capability: MedusaCartCapability;

  function seedSession(session: Partial<MedusaSession>) {
    context.session[SESSION_KEY] = session;
  }

  function readSession(): Partial<MedusaSession> {
    return context.session[SESSION_KEY] as Partial<MedusaSession>;
  }

  beforeEach(() => {
    context = createInitialRequestContext();
    const medusaApi = new MedusaAPI(config, context);
    const factory = new MedusaCartFactory(
      CartSchema,
      MedusaCartIdentifierSchema,
      CartPaginatedSearchResultSchema,
    );
    capability = new MedusaCartCapability(config, new NoOpCache(), context, medusaApi, factory);
  });

  describe('getActiveCartId', () => {
    it('removes a deleted cart from the session and returns NotFound', async () => {
      seedSession({
        activeCartId: { key: 'cart_gone', region_id: 'reg_1' },
        allOwnedCarts: {
          _me: [{ key: 'cart_gone', region_id: 'reg_1' }],
          acme: [{ key: 'cart_gone', region_id: 'reg_1' }, { key: 'cart_live', region_id: 'reg_1' }],
        },
      });

      const result = await capability.getActiveCartId();

      assert(!result.success, 'expected NotFound for a deleted cart');
      expect(result.error.type).toBe('NotFound');
      expect(readSession().activeCartId).toBeUndefined();
      expect(readSession().allOwnedCarts?.['_me']).toEqual([]);
      expect(readSession().allOwnedCarts?.['acme']).toEqual([
        { key: 'cart_live', region_id: 'reg_1' },
      ]);
    });

    it('returns the identifier for a cart that still exists', async () => {
      seedSession({ activeCartId: { key: 'cart_live', region_id: 'reg_1' } });

      const result = await capability.getActiveCartId();

      assert(result.success, 'expected the live cart to resolve');
      expect(result.value.key).toBe('cart_live');
      expect(readSession().activeCartId).toEqual({ key: 'cart_live', region_id: 'reg_1' });
    });
  });

  describe('deleteCart', () => {
    it('keeps the active cart when a different cart is deleted and prunes owned lists', async () => {
      seedSession({
        activeCartId: { key: 'cart_live', region_id: 'reg_1' },
        allOwnedCarts: {
          _me: [{ key: 'cart_live', region_id: 'reg_1' }, { key: 'cart_gone', region_id: 'reg_1' }],
        },
      });

      const result = await capability.deleteCart({
        cart: { key: 'cart_gone' },
      });

      expect(result.success).toBe(true);
      expect(readSession().activeCartId).toEqual({ key: 'cart_live', region_id: 'reg_1' });
      expect(readSession().allOwnedCarts?.['_me']).toEqual([
        { key: 'cart_live', region_id: 'reg_1' },
      ]);
    });

    it('clears the active cart when that cart is deleted', async () => {
      seedSession({
        activeCartId: { key: 'cart_gone', region_id: 'reg_1' },
        allOwnedCarts: { _me: [{ key: 'cart_gone', region_id: 'reg_1' }] },
      });

      const result = await capability.deleteCart({
        cart: { key: 'cart_gone' },
      });

      expect(result.success).toBe(true);
      expect(readSession().activeCartId).toBeUndefined();
      expect(readSession().allOwnedCarts?.['_me']).toEqual([]);
    });

    it('reports provider errors instead of swallowing them', async () => {
      seedSession({
        activeCartId: { key: 'cart_boom', region_id: 'reg_1' },
        allOwnedCarts: { _me: [{ key: 'cart_boom', region_id: 'reg_1' }] },
      });

      const result = await capability.deleteCart({
        cart: { key: 'cart_boom' },
      });

      expect(result.success).toBe(false);
    });
  });
});
