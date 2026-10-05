import 'dotenv/config';
import { assert, describe, expect, it } from 'vitest';
import type { ReactionaryACPServer } from '@reactionary/acp';
import { createInitialRequestContext } from '@reactionary/core';
import {
  ACP_BASE_URL,
  ACP_FEED_ID,
  PROTOCOL_TEST_TIMEOUT,
  ProtocolBackend,
  ProtocolSearchEngine,
  createAcpServer,
  createAcpServerHarness,
  createAcpSession,
  getProtocolBackends,
  getProtocolSearchEngines,
  hasBackendEnv,
  hasSearchEnv,
  type ProtocolSession,
} from './protocol-test-utils.js';

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
    quantity: number;
  };
  base_amount: number;
  total: number;
}

interface AcpFulfillmentOption {
  type: string;
  id: string;
  title: string;
  total: number;
}

interface AcpCheckoutSession {
  id: string;
  status: string;
  currency: string;
  payment_provider: {
    provider: string;
    supported_payment_methods: string[];
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

interface AcpFeedItem {
  item_id: string;
  title: string;
  availability: string;
  price: string;
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

async function readProductFeed(server: ReactionaryACPServer): Promise<AcpFeedItem[]> {
  const response = await server.fetch(
    new Request(`${ACP_BASE_URL}/product_feeds/${ACP_FEED_ID}/products?format=jsonl`),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/x-ndjson');

  const text = await response.text();

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AcpFeedItem);
}

/**
 * Walks the feed items like an agent would and opens a checkout session for the
 * first item that the backend accepts. Not every feed item is guaranteed to be
 * purchasable (inventory, region or price gaps), hence the fallback walk.
 */
async function createCheckoutSessionFromFeed(
  session: ProtocolSession,
  feedItems: AcpFeedItem[],
  details: Record<string, unknown> = { buyer, fulfillment_details: fulfillmentDetails },
): Promise<{ checkoutSession: AcpCheckoutSession; sku: string }> {
  // Prefer items that are explicitly in stock, but fall back to items with an
  // unknown availability: commercetools reports 'unknown' when no inventory
  // entries exist for a SKU even though the product is purchasable.
  const inStock = feedItems.filter((item) => item.availability === 'in_stock');
  const notOutOfStock = feedItems.filter(
    (item) => item.availability !== 'out_of_stock' && item.availability !== 'discontinued',
  );
  const candidates = (inStock.length > 0 ? inStock : notOutOfStock).map((item) => item.item_id);
  const failures: string[] = [];

  expect(candidates.length, 'expected the product feed to contain purchasable items').toBeGreaterThan(0);

  for (const sku of candidates) {
    const response = await session.sendJson<AcpCheckoutSession | AcpError>(
      'POST',
      `${ACP_BASE_URL}/checkout_sessions`,
      {
        line_items: [{ id: sku, quantity: 1 }],
        currency: ACP_CURRENCY,
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
    const server = createAcpServer(backend, search);

    it('discovers the merchant and streams the product feed', async () => {
      // 1. An agent reads the discovery document.
      const discoveryResponse = await server.fetch(
        new Request('https://shop.example.com/.well-known/acp.json'),
      );
      const discovery = (await discoveryResponse.json()) as AcpDiscoveryResponse;

      expect(discoveryResponse.status).toBe(200);
      expect(discovery.protocol.name).toBe('acp');
      expect(discovery.api_base_url).toBe(ACP_BASE_URL);
      expect(discovery.transports).toContain('rest');
      expect(discovery.capabilities.services).toContain('checkout');
      expect(discovery.capabilities.services).toContain('feeds');

      // 2. It checks the readiness document for the available actions.
      const readinessResponse = await server.fetch(new Request(ACP_BASE_URL));
      const readiness = (await readinessResponse.json()) as AcpReadinessResponse;

      expect(readinessResponse.status).toBe(200);
      expect(readiness.status).toBe('ready');
      expect(readiness.actions).toContain('POST /checkout_sessions');
      expect(readiness.actions).toContain('GET /product_feeds/{id}/products');

      // 3. It ingests the product feed built from the configured search engine.
      const feedItems = await readProductFeed(server);

      expect(feedItems.length).toBeGreaterThan(0);
      for (const item of feedItems) {
        expect(item.item_id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.availability).toBeTruthy();
      }
    }, PROTOCOL_TEST_TIMEOUT);

    // The checkout journeys exercise the commerce backend, so they only run on
    // the native-search combination to avoid repeating identical backend
    // coverage per search engine.
    describe.skipIf(search !== ProtocolSearchEngine.NATIVE)('checkout journeys', () => {
      it('runs a feed-to-checkout journey with fulfillment selection and cancellation', async () => {
        const session = createAcpSession(server);

        // 1. The agent picks a purchasable item from the merchant feed.
        const feedItems = await readProductFeed(server);
        const { checkoutSession: created, sku } = await createCheckoutSessionFromFeed(session, feedItems);

        expect(created.id).toMatch(/^checkout_session_/);
        expect(['ready_for_payment', 'not_ready_for_payment']).toContain(created.status);
        expect(created.currency).toBe(created.currency.toLowerCase());
        expect(created.payment_provider.provider).toBeTruthy();
        expect(created.line_items.length).toBe(1);
        expect(created.line_items[0].item).toEqual({ id: sku, quantity: 1 });
        expect(created.line_items[0].total).toBeGreaterThan(0);
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
        expect(updatedItems.body.line_items[0].item).toEqual({ id: sku, quantity: 2 });

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
            payment_data: { token: 'spt_test', provider: 'stripe' },
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
          const feedItems = await readProductFeed(harness.server);
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
            payment_data: { token: 'pm_card_visa', provider: 'stripe' },
          };
          const completed = await session.sendJson<AcpCheckoutSession & { order?: { id: string } }>(
            'POST',
            `${ACP_BASE_URL}/checkout_sessions/${created.id}/complete`,
            completePayload,
          );

          expect(completed.status).toBe(200);
          expect(completed.body.status).toBe('completed');
          const orderId = completed.body.order?.id;
          expect(orderId, 'expected the completed session to reference the placed order').toBeTruthy();

          // 6. Independently verify the order through the reactionary order capability.
          const order = await harness.createCompanionClient().order.getById({ order: { key: orderId ?? '' } });

          if (!order.success) {
            assert.fail(`Order lookup failed: ${JSON.stringify(order.error)}`);
          }

          expect(order.value.identifier.key).toBe(orderId);
          expect(order.value.price.grandTotal.value).toBeGreaterThan(0);
        },
        PROTOCOL_TEST_TIMEOUT,
      );

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
          { line_items: [], currency: ACP_CURRENCY },
        );

        expect(invalid.status).toBe(400);
        expect(invalid.body.type).toBe('invalid_request');
      }, PROTOCOL_TEST_TIMEOUT);
    });
  });
});
