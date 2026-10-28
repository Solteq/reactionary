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
import { MedusaCartIdentifierSchema, type MedusaSession } from '../schema/medusa.schema.js';
import { MedusaConfigurationSchema, type MedusaConfiguration } from '../schema/configuration.schema.js';

/**
 * Offline tests for changeCurrency, against a local stub standing in for the
 * Medusa store API: GET /store/regions serves a DKK and an EUR region, and
 * POST /store/carts/:id applies the requested region and records the body.
 */
interface StubState {
  cartUpdates: { cartId: string; body: { region_id?: string } }[];
}

const REGIONS = [
  { id: 'reg_dkk', name: 'Denmark', currency_code: 'dkk' },
  { id: 'reg_eur', name: 'Europe', currency_code: 'eur' },
];

let server: Server;
let config: MedusaConfiguration;
let stub: StubState;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url || '';
    res.setHeader('Content-Type', 'application/json');

    if (url.startsWith('/store/regions')) {
      res.statusCode = 200;
      res.end(JSON.stringify({ regions: REGIONS }));
      return;
    }

    const updateMatch = url.match(/^\/store\/carts\/([^/?]+)/);
    if (updateMatch && req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        stub.cartUpdates.push({ cartId: updateMatch[1], body });
        const region = REGIONS.find((r) => r.id === body.region_id);
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            cart: {
              id: updateMatch[1],
              region_id: region?.id,
              currency_code: region?.currency_code,
              updated_at: '2026-10-01T00:00:00.000Z',
              items: [],
            },
          }),
        );
      });
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

describe('Medusa cart changeCurrency', () => {
  let context: RequestContext;
  let capability: MedusaCartCapability;

  function readSession(): Partial<MedusaSession> {
    return context.session[SESSION_KEY] as Partial<MedusaSession>;
  }

  beforeEach(() => {
    stub = { cartUpdates: [] };
    context = createInitialRequestContext();
    context.languageContext.currencyCode = 'DKK';
    capability = new MedusaCartCapability(
      config,
      new NoOpCache(),
      context,
      new MedusaAPI(config, context),
      new MedusaCartFactory(CartSchema, MedusaCartIdentifierSchema, CartPaginatedSearchResultSchema),
    );
  });

  it('moves the cart to the region of the requested currency, not the context currency', async () => {
    const result = await capability.changeCurrency({
      cart: { key: 'cart_1' },
      newCurrency: 'EUR',
    });

    assert(result.success, 'expected the currency change to succeed');
    expect(stub.cartUpdates).toEqual([{ cartId: 'cart_1', body: { region_id: 'reg_eur' } }]);
    expect(result.value.identifier.key).toBe('cart_1');
  });

  it('returns InvalidInput without updating the cart when no region serves the currency', async () => {
    const result = await capability.changeCurrency({
      cart: { key: 'cart_1' },
      newCurrency: 'USD',
    });

    assert(!result.success, 'expected a failed result for an unserved currency');
    expect(result.error.type).toBe('InvalidInput');
    expect(stub.cartUpdates).toEqual([]);
  });

  it('refreshes the active cart identifier when the active cart is changed', async () => {
    context.session[SESSION_KEY] = { activeCartId: { key: 'cart_1', region_id: 'reg_dkk' } };

    const result = await capability.changeCurrency({
      cart: { key: 'cart_1' },
      newCurrency: 'EUR',
    });

    assert(result.success, 'expected the currency change to succeed');
    expect(readSession().activeCartId).toEqual({ key: 'cart_1', region_id: 'reg_eur' });
  });

  it('leaves the active cart alone when another cart is changed', async () => {
    context.session[SESSION_KEY] = { activeCartId: { key: 'cart_active', region_id: 'reg_dkk' } };

    const result = await capability.changeCurrency({
      cart: { key: 'cart_other' },
      newCurrency: 'EUR',
    });

    assert(result.success, 'expected the currency change to succeed');
    expect(readSession().activeCartId).toEqual({ key: 'cart_active', region_id: 'reg_dkk' });
  });

  it('does not make a cart the active one when there is no active cart', async () => {
    const result = await capability.changeCurrency({
      cart: { key: 'cart_1' },
      newCurrency: 'EUR',
    });

    assert(result.success, 'expected the currency change to succeed');
    expect(readSession()?.activeCartId).toBeUndefined();
  });
});
