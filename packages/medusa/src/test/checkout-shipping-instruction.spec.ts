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
import { MedusaAPI } from '../core/client.js';
import { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import {
  MedusaConfigurationSchema,
  type MedusaConfiguration,
} from '../schema/configuration.schema.js';

/**
 * Offline tests for the shipping instruction's protocol data channel, against
 * a local stub standing in for the Medusa store API: client-set protocol data
 * travels out on the add-shipping-method `data` payload, and whatever the
 * backend persisted on the shipping method's `data` (e.g. nShift's session_id
 * and delivery_time plus the merged agent fields) is surfaced back on the
 * instruction's protocolData.
 */
let server: Server;
let config: MedusaConfiguration;

let requests: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];

/** The persisted shipping method `data` the stubbed cart responds with. */
let persistedShippingMethodData: Record<string, unknown> = {};

function stubCart(cartId: string) {
  return {
    id: cartId,
    region_id: 'reg_1',
    currency_code: 'eur',
    email: 'instruction@example.com',
    items: [],
    shipping_methods: [{ shipping_option_id: 'so_nshift', data: persistedShippingMethodData }],
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
      const cartMatch = req.url?.match(/^\/store\/carts\/([^/?]+)/);
      if (cartMatch) {
        res.end(JSON.stringify({ cart: stubCart(cartMatch[1]) }));
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

describe('Medusa shipping instruction protocol data', () => {
  let context: RequestContext;
  let capability: MedusaCheckoutCapability;

  beforeEach(() => {
    requests = [];
    persistedShippingMethodData = {};
    context = createInitialRequestContext();
    capability = new MedusaCheckoutCapability(
      config,
      new NoOpCache(),
      context,
      new MedusaAPI(config, context),
      new MedusaCheckoutFactory(CheckoutSchema, ShippingMethodSchema, PaymentMethodSchema),
    );
  });

  function shippingMethodPostBody(): Record<string, unknown> | undefined {
    return requests.find(
      (request) =>
        request.method === 'POST' && request.url.includes('/shipping-methods'),
    )?.body;
  }

  it('sends client protocol data and the pickup point on the shipping method data', async () => {
    const result = await capability.setShippingInstruction({
      checkout: { key: 'cart_in_1' },
      shippingInstruction: {
        shippingMethod: { key: 'so_nshift' },
        pickupPoint: 'TEST-AGENT-1',
        instructions: 'leave at desk',
        consentForUnattendedDelivery: true,
        protocolData: [
          { key: 'agent_id', value: 'TEST-AGENT-1' },
          { key: 'agent', value: { name: 'K-Market Keskusta', postal_code: '00100' } },
        ],
      },
    });

    assert(result.success, `setShippingInstruction failed: ${JSON.stringify(result)}`);
    expect(shippingMethodPostBody()).toEqual({
      option_id: 'so_nshift',
      data: {
        consent_for_unattended_delivery: 'true',
        instructions: 'leave at desk',
        agent_id: 'TEST-AGENT-1',
        agent: { name: 'K-Market Keskusta', postal_code: '00100' },
        pickup_point: 'TEST-AGENT-1',
      },
    });
  });

  it('sends the unchanged payload when no protocol data or pickup point is set', async () => {
    const result = await capability.setShippingInstruction({
      checkout: { key: 'cart_in_2' },
      shippingInstruction: {
        shippingMethod: { key: 'so_nshift' },
        pickupPoint: '',
        instructions: '',
        consentForUnattendedDelivery: false,
      },
    });

    assert(result.success, `setShippingInstruction failed: ${JSON.stringify(result)}`);
    expect(shippingMethodPostBody()).toEqual({
      option_id: 'so_nshift',
      data: {
        consent_for_unattended_delivery: 'false',
        instructions: '',
      },
    });
  });

  it('surfaces the persisted provider data as instruction protocol data', async () => {
    persistedShippingMethodData = {
      session_id: 'nshift-session-123',
      option_id: 'pan-nordic-749',
      carrier_id: 'Postnord',
      delivery_time: { from: '2026-10-15', to: '2026-10-17' },
      agent_id: 'TEST-AGENT-1',
      // first-class or misleading keys that must not leak into protocolData:
      pickup_point: 'TEST-AGENT-1',
      pickup_store: 'sloc_copenhagen',
      price: 3.99,
      currency_code: 'eur',
      instructions: 'leave at desk',
      consent_for_unattended_delivery: 'true',
    };

    const result = await capability.getById({ identifier: { key: 'cart_out_1' } });

    assert(result.success, `getById failed: ${JSON.stringify(result)}`);
    const instruction = result.value.shippingInstruction;
    assert(instruction, 'no shipping instruction parsed');

    expect(instruction.protocolData).toEqual([
      { key: 'session_id', value: 'nshift-session-123' },
      { key: 'option_id', value: 'pan-nordic-749' },
      { key: 'carrier_id', value: 'Postnord' },
      { key: 'delivery_time', value: { from: '2026-10-15', to: '2026-10-17' } },
      { key: 'agent_id', value: 'TEST-AGENT-1' },
    ]);
    expect(instruction.pickupPoint).toBe('TEST-AGENT-1');
    expect(instruction.store).toEqual({ key: 'sloc_copenhagen' });
    expect(instruction.instructions).toBe('leave at desk');
    expect(instruction.consentForUnattendedDelivery).toBe(true);
  });

  it('still surfaces the legacy shipping_protocol_data JSON entries not present flat', async () => {
    persistedShippingMethodData = {
      session_id: 'nshift-session-123',
      shipping_protocol_data: JSON.stringify({
        session_id: 'stale-overridden',
        legacy_slot: 'monday-am',
      }),
    };

    const result = await capability.getById({ identifier: { key: 'cart_out_2' } });

    assert(result.success, `getById failed: ${JSON.stringify(result)}`);
    expect(result.value.shippingInstruction?.protocolData).toEqual([
      { key: 'session_id', value: 'nshift-session-123' },
      { key: 'legacy_slot', value: 'monday-am' },
    ]);
  });
});
