import 'dotenv/config';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { assert, describe, expect, it, vi } from 'vitest';
import { createInitialRequestContext } from '@reactionary/core';
import {
  ACP_BASE_URL,
  PROTOCOL_TEST_TIMEOUT,
  ProtocolBackend,
  ProtocolSearchEngine,
  createAcpServerHarness,
  createAcpSession,
  getProtocolBackends,
  getProtocolSearchEngines,
  hasBackendEnv,
  hasSearchEnv,
  type AcpServerHarness,
  type ProtocolSession,
} from './protocol-test-utils.js';

// Responses are validated against the official ACP 2026-04-17 schemas.
const SPEC_FIXTURES = new URL('../../../../packages/acp/src/lib/__fixtures__/acp-spec-2026-04-17/', import.meta.url);
const checkoutSchema = loadSpecSchema('schema.agentic_checkout.json');
const cartSchema = loadSpecSchema('schema.cart.json');
const feedSchema = loadSpecSchema('../../../../../feeds/src/lib/__fixtures__/acp-spec-2026-04-17/schema.feed.json');
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(checkoutSchema);
ajv.addSchema({ ...checkoutSchema, $id: new URL('schema.agentic_checkout.json', String(cartSchema['$id'])).href });
ajv.addSchema(cartSchema);
ajv.addSchema(feedSchema);

function loadSpecSchema(name: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(new URL(name, SPEC_FIXTURES), 'utf8'));

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${name}`);
  }

  return Object.fromEntries(Object.entries(value));
}

function expectSpecValid(definition: string, value: unknown, schema: Record<string, unknown> = checkoutSchema): void {
  const validate = ajv.getSchema(`${String(schema['$id'])}#/$defs/${definition}`);

  expect(validate, definition).toBeDefined();
  expect(validate?.(value), `${definition}: ${ajv.errorsText(validate?.errors)}`).toBe(true);
}

// The e2e backends price in the initial request context's currency.
const ACP_CURRENCY = createInitialRequestContext().languageContext.currencyCode.toLowerCase();

interface AcpDiscoveryResponse {
  protocol: {
    name: string;
    version: string;
    supported_versions: string[];
  };
  api_base_url: string;
  transports: string[];
  capabilities: {
    services: string[];
  };
}

interface AcpReadinessResponse {
  name: string;
  protocol: string;
  status: string;
  actions: string[];
}

interface AcpTotal {
  type: string;
  display_text: string;
  amount: number;
}

interface AcpLineItem {
  id: string;
  item: {
    id: string;
  };
  quantity: number;
  name?: string;
  unit_amount: number;
  totals: AcpTotal[];
}

interface AcpFulfillmentOption {
  type: string;
  id: string;
  title: string;
  totals: AcpTotal[];
}

interface AcpCheckoutSession {
  id: string;
  status: string;
  currency: string;
  capabilities: {
    payment?: { handlers: Array<{ id: string; name: string; psp: string }> };
  };
  line_items: AcpLineItem[];
  fulfillment_options: AcpFulfillmentOption[];
  selected_fulfillment_options?: Array<{ type: string; option_id: string; item_ids: string[] }>;
  totals: AcpTotal[];
  links: Array<{ type: string; url: string }>;
}

interface AcpError {
  type: string;
  code: string;
  message: string;
}

interface AcpFeedProduct {
  id: string;
  title?: string;
  variants: Array<{
    id: string;
    title: string;
    availability?: { available?: boolean; status?: string };
    price?: { amount: number; currency: string };
  }>;
}

const buyer = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
};

const fulfillmentDetails = {
  name: 'Ada Lovelace',
  address: {
    name: 'Ada Lovelace',
    line_one: '123 Main St',
    city: 'Anytown',
    state: 'Hovedstaden',
    country: 'DK',
    postal_code: '12345',
  },
};

function selectShipping(optionId: string | undefined) {
  return {
    selected_fulfillment_options: optionId ? [{ type: 'shipping', option_id: optionId, item_ids: [] }] : null,
  };
}

async function readProductFeed(harness: AcpServerHarness): Promise<AcpFeedProduct[]> {
  return (await harness.readFeedProducts()) as AcpFeedProduct[];
}

/**
 * Walks the feed items like an agent would and opens a checkout session for the
 * first item that the backend accepts. Not every feed item is guaranteed to be
 * purchasable (inventory, region or price gaps), hence the fallback walk.
 */
async function createCheckoutSessionFromFeed(
  session: ProtocolSession,
  feedProducts: AcpFeedProduct[],
  details: Record<string, unknown> = { buyer, fulfillment_details: fulfillmentDetails },
): Promise<{ checkoutSession: AcpCheckoutSession; sku: string }> {
  // Prefer items that are explicitly in stock, but fall back to items with an
  // unknown availability: commercetools reports 'unknown' when no inventory
  // entries exist for a SKU even though the product is purchasable.
  const variants = feedProducts.flatMap((product) => product.variants);
  const inStock = variants.filter((variant) => variant.availability?.status === 'in_stock');
  const notOutOfStock = variants.filter(
    (variant) => variant.availability?.status !== 'out_of_stock' && variant.availability?.status !== 'discontinued',
  );
  const candidates = (inStock.length > 0 ? inStock : notOutOfStock).map((variant) => variant.id);
  const failures: string[] = [];

  expect(candidates.length, 'expected the product feed to contain purchasable items').toBeGreaterThan(0);

  for (const sku of candidates) {
    const response = await session.sendJson<AcpCheckoutSession | AcpError>(
      'POST',
      `${ACP_BASE_URL}/checkout_sessions`,
      {
        line_items: [{ id: sku, quantity: 1 }],
        currency: ACP_CURRENCY,
        capabilities: { interventions: { supported: [] } },
        ...details,
      },
    );

    if (response.status === 201) {
      return { checkoutSession: response.body as AcpCheckoutSession, sku };
    }

    failures.push(`${sku}: ${JSON.stringify(response.body)}`);
  }

  assert.fail(`No feed item could be checked out. Failures: ${failures.join('; ')}`);
}

const combinations = getProtocolBackends().flatMap((backend) =>
  getProtocolSearchEngines().map((search) => ({ backend, search })),
);

describe.each(combinations)('ACP e2e - $backend + $search', ({ backend, search }) => {
  const available = hasBackendEnv(backend) && hasSearchEnv(search);

  describe.skipIf(!available)('agentic commerce flows', () => {
    const harness = createAcpServerHarness(backend, search);
    const server = harness.server;

    it('discovers the merchant and publishes the product feed', async () => {
      // 1. An agent reads the discovery document.
      const discoveryResponse = await server.fetch(
        new Request('https://shop.example.com/.well-known/acp.json'),
      );
      const discovery = (await discoveryResponse.json()) as AcpDiscoveryResponse;

      expect(discoveryResponse.status).toBe(200);
      expectSpecValid('DiscoveryResponse', discovery);
      expect(discovery.protocol.name).toBe('acp');
      expect(discovery.api_base_url).toBe(ACP_BASE_URL);
      expect(discovery.transports).toContain('rest');
      expect(discovery.capabilities.services).toEqual(['checkout', 'orders', 'carts']);
      expect(discovery.capabilities.services).not.toContain('feeds');

      // 2. It checks the readiness document for the available actions.
      const readinessResponse = await server.fetch(new Request(ACP_BASE_URL));
      const readiness = (await readinessResponse.json()) as AcpReadinessResponse;

      expect(readinessResponse.status).toBe(200);
      expect(readiness.status).toBe('ready');
      expect(readiness.actions).toContain('POST /checkout_sessions');

      // 3. The merchant pushes its product feed, built from the configured
      // search engine, to the agent's Feed API.
      const feedProducts = await readProductFeed(harness);

      expect(feedProducts.length).toBeGreaterThan(0);
      for (const product of feedProducts) {
        expectSpecValid('Product', product, feedSchema);
        expect(product.id).toBeTruthy();
        expect(product.variants.length).toBeGreaterThan(0);
        for (const variant of product.variants) {
          expect(variant.id).toBeTruthy();
          expect(variant.title).toBeTruthy();
        }
      }
    }, PROTOCOL_TEST_TIMEOUT);

    // The checkout journeys exercise the commerce backend, so they only run on
    // the native-search combination to avoid repeating identical backend
    // coverage per search engine.
    describe.skipIf(search !== ProtocolSearchEngine.NATIVE)('checkout journeys', () => {
      it('runs a feed-to-checkout journey with fulfillment selection and cancellation', async () => {
        const session = createAcpSession(server);

        // 1. The agent picks a purchasable item from the merchant feed.
        const feedItems = await readProductFeed(harness);
        const { checkoutSession: created, sku } = await createCheckoutSessionFromFeed(session, feedItems);

        expect(created.id).toMatch(/^checkout_session_/);
        expectSpecValid('CheckoutSession', created);
        expect(['ready_for_payment', 'not_ready_for_payment']).toContain(created.status);
        expect(created.currency).toBe(created.currency.toLowerCase());
        expect(created.capabilities.payment?.handlers[0]).toMatchObject({
          id: 'card_tokenized',
          name: 'dev.acp.tokenized.card',
          psp: 'stripe',
        });
        expect(created.line_items.length).toBe(1);
        expect(created.line_items[0].item).toEqual({ id: sku });
        expect(created.line_items[0].quantity).toBe(1);
        expect(created.line_items[0].name).toBeTruthy();
        expect(created.line_items[0].totals.find((total) => total.type === 'total')?.amount).toBeGreaterThan(0);
        expect(created.totals.find((total) => total.type === 'total')?.amount).toBeGreaterThan(0);
        expect(created.links).toEqual([
          { type: 'terms_of_use', url: 'https://shop.example.com/terms' },
        ]);

        // 2. It re-reads the session.
        const fetched = await session.get<AcpCheckoutSession>(
          `${ACP_BASE_URL}/checkout_sessions/${created.id}`,
        );

        expect(fetched.status).toBe(200);
        expect(fetched.body.id).toBe(created.id);
        expect(fetched.body.line_items[0].item.id).toBe(sku);

        // 3. The buyer raises the quantity.
        const updatedItems = await session.sendJson<AcpCheckoutSession>(
          'POST',
          `${ACP_BASE_URL}/checkout_sessions/${created.id}`,
          { line_items: [{ id: sku, quantity: 2 }] },
        );

        expect(updatedItems.status).toBe(200);
        expect(updatedItems.body.line_items[0].item).toEqual({ id: sku });
        expect(updatedItems.body.line_items[0].quantity).toBe(2);

        // 4. The buyer picks a fulfillment option when the backend offers any.
        const fulfillmentOption = updatedItems.body.fulfillment_options.find(
          (option) => option.type === 'shipping',
        );

        if (fulfillmentOption) {
          const updatedFulfillment = await session.sendJson<AcpCheckoutSession>(
            'POST',
            `${ACP_BASE_URL}/checkout_sessions/${created.id}`,
            selectShipping(fulfillmentOption.id),
          );

          expect(updatedFulfillment.status).toBe(200);
          expect(updatedFulfillment.body.selected_fulfillment_options?.[0]?.option_id).toBe(fulfillmentOption.id);
        }

        // 5. The buyer abandons the purchase.
        const canceled = await session.sendJson<AcpCheckoutSession>(
          'POST',
          `${ACP_BASE_URL}/checkout_sessions/${created.id}/cancel`,
          {},
        );

        expect(canceled.status).toBe(200);
        expect(canceled.body.status).toBe('canceled');

        // 6. Completing a canceled session is refused. A real completion is not
        // exercised: it needs a delegated payment token from a live PSP.
        const completeAfterCancel = await session.sendJson<AcpError>(
          'POST',
          `${ACP_BASE_URL}/checkout_sessions/${created.id}/complete`,
          {
            buyer,
            payment_data: {
              handler_id: 'card_tokenized',
              instrument: { type: 'card', credential: { type: 'spt', token: 'spt_test' } },
            },
          },
        );

        expect(completeAfterCancel.status).toBe(405);

        // 7. Cancelling twice is refused as well.
        const cancelAgain = await session.sendJson<AcpError>(
          'POST',
          `${ACP_BASE_URL}/checkout_sessions/${created.id}/cancel`,
          {},
        );

        expect(cancelAgain.status).toBe(405);
      }, PROTOCOL_TEST_TIMEOUT);

      // See the UCP suite: only commercetools lets the test play the PSP's
      // out-of-band authorization role.
      it.skipIf(backend !== ProtocolBackend.COMMERCETOOLS)(
        'places a real order from the feed and verifies it through the order capability',
        async () => {
          const harness = createAcpServerHarness(backend, search);
          const session = createAcpSession(harness.server);
          const email = `ada+${crypto.randomUUID()}@example.com`;
          const orderBuyer = { first_name: 'Ada', last_name: 'Lovelace', email };

          // 1. The agent opens a session with just the item; the buyer is unknown.
          const feedItems = await readProductFeed(harness);
          const { checkoutSession: created } = await createCheckoutSessionFromFeed(session, feedItems, {});

          expect(created.status).toBe('not_ready_for_payment');
          expect(created.fulfillment_options).toEqual([]);

          // 2. Buyer details and the shipping address arrive; options are quoted.
          const withAddress = await session.sendJson<AcpCheckoutSession>(
            'POST',
            `${ACP_BASE_URL}/checkout_sessions/${created.id}`,
            { buyer: orderBuyer, fulfillment_details: fulfillmentDetails },
          );

          expect(withAddress.status).toBe(200);
          expectSpecValid('CheckoutSession', withAddress.body);
          const option = withAddress.body.fulfillment_options.find((candidate) => candidate.type === 'shipping');
          expect(option, 'expected a shipping option for the address').toBeDefined();
          expect(withAddress.body.status).toBe('not_ready_for_payment');

          // 3. The buyer picks the option; the session becomes payable.
          const ready = await session.sendJson<AcpCheckoutSession>(
            'POST',
            `${ACP_BASE_URL}/checkout_sessions/${created.id}`,
            selectShipping(option?.id),
          );

          expect(ready.body.status).toBe('ready_for_payment');

          // 4. Completing with the delegated payment token places the real
          // checkout and its Stripe payment. The payment API extension confirms
          // the token with Stripe server-side (a real shared payment token is
          // minted per agent, so the test delegates Stripe's test PaymentMethod
          // instead), so the payment is authorized within the payment create and
          // no out-of-band PSP webhook needs simulating.
          const completePayload = {
            buyer: orderBuyer,
            payment_data: {
              handler_id: 'card_tokenized',
              instrument: { type: 'card', credential: { type: 'spt', token: 'pm_card_visa' } },
            },
          };
          const completed = await session.sendJson<AcpCheckoutSession & { order?: { id: string; permalink_url?: string } }>(
            'POST',
            `${ACP_BASE_URL}/checkout_sessions/${created.id}/complete`,
            completePayload,
          );

          expect(completed.status).toBe(200);
          expect(completed.body.status).toBe('completed');
          expectSpecValid('CheckoutSessionWithOrder', completed.body);
          const orderId = completed.body.order?.id;
          expect(orderId, 'expected the completed session to reference the placed order').toBeTruthy();
          expect(completed.body.order?.permalink_url).toBe(`https://shop.example.com/orders/${orderId}`);

          // 6. Independently verify the order through the reactionary order capability.
          const order = await harness.createCompanionClient().order.getById({ order: { key: orderId ?? '' } });

          if (!order.success) {
            assert.fail(`Order lookup failed: ${JSON.stringify(order.error)}`);
          }

          expect(order.value.identifier.key).toBe(orderId);
          expect(order.value.price.grandTotal.value).toBeGreaterThan(0);

          // 7. The agent was told about the order through its webhook.
          await vi.waitFor(() => expect(harness.webhookEvents).toContainEqual(expect.objectContaining({
            type: 'order_create',
            data: expect.objectContaining({ id: orderId, checkout_session_id: created.id }),
          })));
          for (const event of harness.webhookEvents) {
            expectSpecValid('Order', (event as { data: unknown }).data);
          }
        },
        PROTOCOL_TEST_TIMEOUT,
      );

      it('builds a basket with the cart capability', async () => {
        const session = createAcpSession(server);
        const variants = (await readProductFeed(harness)).flatMap((product) => product.variants);
        const sku = variants.find((variant) => variant.availability?.status !== 'out_of_stock')?.id ?? variants[0]?.id;

        const created = await session.sendJson<{ id: string; line_items: AcpLineItem[]; totals: AcpTotal[] }>(
          'POST',
          `${ACP_BASE_URL}/carts`,
          { line_items: [{ id: sku, quantity: 1 }] },
        );

        expect(created.status).toBe(201);
        expectSpecValid('Cart', created.body, cartSchema);
        expect(created.body.line_items[0]?.item.id).toBe(sku);
        expect(created.body.totals.find((total) => total.type === 'total')?.amount).toBeGreaterThan(0);

        const updated = await session.sendJson<{ line_items: AcpLineItem[] }>(
          'PUT',
          `${ACP_BASE_URL}/carts/${created.body.id}`,
          { line_items: [{ id: sku, quantity: 3 }] },
        );

        expect(updated.status).toBe(200);
        expect(updated.body.line_items[0]?.quantity).toBe(3);

        const canceled = await session.sendJson<{ id: string }>('POST', `${ACP_BASE_URL}/carts/${created.body.id}/cancel`, {});

        expect(canceled.status).toBe(200);
        expect((await session.get(`${ACP_BASE_URL}/carts/${created.body.id}`)).status).toBe(404);
      }, PROTOCOL_TEST_TIMEOUT);

      it('rejects malformed and unknown checkout session requests', async () => {
        const session = createAcpSession(server);

        // Unknown sessions are reported as missing...
        const missing = await session.get<AcpError>(
          `${ACP_BASE_URL}/checkout_sessions/checkout_session_does_not_exist`,
        );

        expect(missing.status).toBe(404);
        expect(missing.body.code).toBe('missing');

        // ...and payloads that do not match the protocol schema are rejected.
        const invalid = await session.sendJson<AcpError>(
          'POST',
          `${ACP_BASE_URL}/checkout_sessions`,
          { line_items: [], currency: ACP_CURRENCY, capabilities: {} },
        );

        expect(invalid.status).toBe(400);
        expect(invalid.body.type).toBe('invalid_request');
      }, PROTOCOL_TEST_TIMEOUT);
    });
  });
});
