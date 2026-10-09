import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CheckoutSchema,
  createInitialRequestContext,
  NoOpCache,
  OrderSchema,
  PaymentMethodSchema,
  ShippingMethodSchema,
  type RequestContext,
} from '@reactionary/core';
import { MedusaCheckoutCapability } from '../capabilities/checkout.capability.js';
import { MedusaOrderCapability } from '../capabilities/order.capability.js';
import { MedusaAPI } from '../core/client.js';
import { MedusaCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import { MedusaOrderFactory } from '../factories/order/order.factory.js';
import { MedusaConfigurationSchema, type MedusaConfiguration } from '../schema/configuration.schema.js';

/**
 * Offline tests asserting that a missing checkout (cart) or order comes back
 * as a typed NotFound result instead of a thrown FetchError, against a local
 * stub standing in for the Medusa store API: ids containing "gone" are 404,
 * ids containing "boom" are 500.
 */
let server: Server;
let config: MedusaConfiguration;

beforeAll(async () => {
  server = createServer((req, res) => {
    const match = req.url?.match(/^\/store\/(?:carts|orders)\/([^/?]+)/);
    const entityId = match?.[1] || '';
    res.setHeader('Content-Type', 'application/json');
    if (entityId.includes('gone')) {
      res.statusCode = 404;
      res.end(JSON.stringify({ type: 'not_found', message: `${entityId} was not found` }));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ type: 'unknown_error', message: 'boom' }));
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

describe('Medusa typed NotFound results', () => {
  let context: RequestContext;
  let medusaApi: MedusaAPI;

  beforeEach(() => {
    context = createInitialRequestContext();
    medusaApi = new MedusaAPI(config, context);
  });

  function checkoutCapability() {
    return new MedusaCheckoutCapability(
      config,
      new NoOpCache(),
      context,
      medusaApi,
      new MedusaCheckoutFactory(CheckoutSchema, ShippingMethodSchema, PaymentMethodSchema),
    );
  }

  function orderCapability() {
    return new MedusaOrderCapability(
      config,
      new NoOpCache(),
      context,
      medusaApi,
      new MedusaOrderFactory(OrderSchema),
    );
  }

  describe('checkout getById', () => {
    it('returns NotFound for a deleted cart', async () => {
      const result = await checkoutCapability().getById({ identifier: { key: 'cart_gone' } });

      assert(!result.success, 'expected a failed result for a deleted cart');
      expect(result.error.type).toBe('NotFound');
    });

    it('reports other provider errors without claiming NotFound', async () => {
      const result = await checkoutCapability().getById({ identifier: { key: 'cart_boom' } });

      assert(!result.success, 'expected a failed result for a server error');
      expect(result.error.type).not.toBe('NotFound');
    });
  });

  describe('checkout finalizeCheckout', () => {
    it('propagates NotFound for a deleted cart instead of reporting it as not ready', async () => {
      const result = await checkoutCapability().finalizeCheckout({
        checkout: { key: 'cart_gone' },
      });

      assert(!result.success, 'expected a failed result for a deleted cart');
      expect(result.error.type).toBe('NotFound');
    });
  });

  describe('order getById', () => {
    it('returns NotFound for a missing order', async () => {
      const result = await orderCapability().getById({ order: { key: 'order_gone' } });

      assert(!result.success, 'expected a failed result for a missing order');
      expect(result.error.type).toBe('NotFound');
    });

    it('reports other provider errors without claiming NotFound', async () => {
      const result = await orderCapability().getById({ order: { key: 'order_boom' } });

      assert(!result.success, 'expected a failed result for a server error');
      expect(result.error.type).not.toBe('NotFound');
    });
  });
});
