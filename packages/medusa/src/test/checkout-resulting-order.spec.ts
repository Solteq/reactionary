import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CheckoutSchema,
  createInitialRequestContext,
  NoOpCache,
  PaymentMethodSchema,
  ShippingMethodSchema,
  type RequestContext,
} from '@reactionary/core';
import { MedusaCheckoutCapability } from '../capabilities/checkout.capability.js';
import { MedusaAPI, SESSION_KEY } from '../core/client.js';
import { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import {
  MedusaConfigurationSchema,
  type MedusaConfiguration,
} from '../schema/configuration.schema.js';
import type { MedusaSession } from '../schema/medusa.schema.js';

/**
 * Offline tests for how finalizing a checkout reports the created order,
 * against a local stub standing in for the Medusa store API. Newer Medusa
 * versions no longer hydrate the +order.* fields on the store cart endpoint,
 * so the stub never returns an order relation on the cart — exactly the
 * situation the completion-response fallback and the session map cover.
 */
let server: Server;
let config: MedusaConfiguration;

/** Every request the stub served, in order, with any parsed JSON body. */
let requests: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];

/** The order payload the next completion responds with. */
let completionOrder: Record<string, unknown> = { id: 'order_1', display_id: 7 };

function finalizableCart(cartId: string) {
  return {
    id: cartId,
    region_id: 'reg_1',
    currency_code: 'eur',
    email: 'finalize@example.com',
    total: 100,
    item_subtotal: 100,
    shipping_total: 0,
    tax_total: 0,
    discount_total: 0,
    items: [],
    billing_address: { id: 'addr_bill', first_name: 'John', last_name: 'Doe' },
    shipping_address: { id: 'addr_ship', first_name: 'John', last_name: 'Doe' },
    shipping_methods: [{ shipping_option_id: 'so_1', data: {} }],
    payment_collection: {
      id: 'pay_col_1',
      status: 'authorized',
      amount: 100,
      currency_code: 'eur',
      payment_sessions: [
        { id: 'payses_1', status: 'authorized', provider_id: 'pp_system_default', data: {} },
      ],
    },
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
      requests.push({ method: req.method || '', url: req.url || '', body });

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;

      const completeMatch = req.url?.match(/^\/store\/carts\/([^/?]+)\/complete/);
      if (completeMatch && req.method === 'POST') {
        res.end(JSON.stringify({ type: 'order', order: completionOrder }));
        return;
      }

      const cartMatch = req.url?.match(/^\/store\/carts\/([^/?]+)/);
      if (cartMatch) {
        res.end(JSON.stringify({ cart: finalizableCart(cartMatch[1]) }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ type: 'not_found', message: `No stub for ${req.url}` }));
    });
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

describe('Medusa checkout resulting order', () => {
  let context: RequestContext;
  let capability: MedusaCheckoutCapability;

  function buildCapability(ctx: RequestContext) {
    return new MedusaCheckoutCapability(
      config,
      new NoOpCache(),
      ctx,
      new MedusaAPI(config, ctx),
      new MedusaCheckoutFactory(CheckoutSchema, ShippingMethodSchema, PaymentMethodSchema),
    );
  }

  beforeEach(() => {
    requests = [];
    completionOrder = { id: 'order_1', display_id: 7 };
    context = createInitialRequestContext();
    capability = buildCapability(context);
  });

  it('returns the order from the completion response when the cart carries no order relation', async () => {
    const result = await capability.finalizeCheckout({ checkout: { key: 'cart_fin_1' } });

    assert(result.success, `finalize failed: ${JSON.stringify(result)}`);
    expect(result.value.resultingOrder).toEqual({ key: 'order_1', display_id: 7 });
  });

  it('prefers the custom display id, matching the factory precedence', async () => {
    completionOrder = { id: 'order_2', display_id: 7, custom_display_id: '1007' };

    const result = await capability.finalizeCheckout({ checkout: { key: 'cart_fin_2' } });

    assert(result.success, `finalize failed: ${JSON.stringify(result)}`);
    expect(result.value.resultingOrder).toEqual({ key: 'order_2', display_id: 1007 });
  });

  it('stamps the cart id into the cart metadata before completing', async () => {
    await capability.finalizeCheckout({ checkout: { key: 'cart_fin_3' } });

    const updateIndex = requests.findIndex(
      (request) =>
        request.method === 'POST' &&
        /\/store\/carts\/cart_fin_3(\?|$)/.test(request.url) &&
        request.body?.['metadata'] !== undefined,
    );
    const completeIndex = requests.findIndex((request) =>
      request.url.includes('/store/carts/cart_fin_3/complete'),
    );

    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(completeIndex).toBeGreaterThan(updateIndex);
    expect(requests[updateIndex].body).toEqual({ metadata: { cart_id: 'cart_fin_3' } });
  });

  it('remembers the finalized order in the session and hydrates later reads', async () => {
    await capability.finalizeCheckout({ checkout: { key: 'cart_fin_4' } });

    const session = context.session[SESSION_KEY] as Partial<MedusaSession>;
    expect(session.finalizedOrders).toEqual({
      'cart_fin_4': { key: 'order_1', display_id: 7 },
    });

    // A later read in the same session — even through a freshly constructed
    // capability — reports the resulting order although the cart payload
    // itself has no order relation.
    const laterCapability = buildCapability(context);
    const reread = await laterCapability.getById({ identifier: { key: 'cart_fin_4' } });

    assert(reread.success, `getById failed: ${JSON.stringify(reread)}`);
    expect(reread.value.resultingOrder).toEqual({ key: 'order_1', display_id: 7 });
  });

  it('leaves resultingOrder absent for checkouts never finalized in this session', async () => {
    const result = await capability.getById({ identifier: { key: 'cart_never_finalized' } });

    assert(result.success, `getById failed: ${JSON.stringify(result)}`);
    expect(result.value.resultingOrder).toBeUndefined();
  });
});
