import 'dotenv/config';
import { assert, describe, expect, it } from 'vitest';
import {
  PROTOCOL_TEST_TIMEOUT,
  ProtocolBackend,
  ProtocolSearchEngine,
  UCP_BASE_URL,
  createUcpServer,
  createUcpSession,
  getProtocolBackends,
  getProtocolSearchEngines,
  hasBackendEnv,
  hasSearchEnv,
  type ProtocolSession,
} from './protocol-test-utils.js';

const testData = {
  searchTerm: 'Bag',
};

interface UcpMetadata {
  version: string;
  status: 'success' | 'error';
  payment_handlers?: Record<string, Array<{ id: string; version: string }>>;
}

interface UcpResponseMessage {
  message?: {
    type?: string;
    content?: string;
    code?: string;
  };
  type?: string;
  code?: string;
  content?: string;
}

interface UcpProfileResponse {
  ucp: {
    version: string;
    services: Record<string, Array<{ endpoint?: string; transport?: string }>>;
    capabilities: Record<string, Array<{ version: string }>>;
    payment_handlers?: Record<string, Array<{ id: string; version: string }>>;
  };
  merchant: { name: string };
  keys: unknown[];
}

interface UcpVariant {
  id: string;
  sku?: string;
  title?: string;
}

interface UcpProduct {
  id: string;
  title: string;
  variants: UcpVariant[];
}

interface UcpSearchResponse {
  ucp: UcpMetadata;
  products?: UcpProduct[];
  pagination?: {
    cursor?: string;
    has_next_page: boolean;
    total_count: number;
  };
  messages?: UcpResponseMessage[];
}

interface UcpProductResponse {
  ucp: UcpMetadata;
  product?: UcpProduct;
  messages?: UcpResponseMessage[];
}

interface UcpTotal {
  type: string;
  amount: number;
}

interface UcpLineItem {
  id: string;
  item: {
    id: string;
    title: string;
    price: number;
  };
  quantity: number;
  totals: UcpTotal[];
}

interface UcpCartResponse {
  ucp: UcpMetadata;
  id?: string;
  line_items?: UcpLineItem[];
  currency?: string;
  totals?: UcpTotal[];
  messages?: UcpResponseMessage[];
}

interface UcpCheckoutResponse {
  ucp: UcpMetadata;
  id?: string;
  status?: string;
  line_items?: UcpLineItem[];
  currency?: string;
  totals?: UcpTotal[];
  messages?: UcpResponseMessage[];
}

function describeUcpError(body: { messages?: UcpResponseMessage[] }): string {
  return JSON.stringify(body.messages ?? 'no error messages in response');
}

function expectUcpSuccess(body: { ucp: UcpMetadata; messages?: UcpResponseMessage[] }): void {
  expect(body.ucp.status, describeUcpError(body)).toBe('success');
}

function toCartLineItem(sku: string, quantity: number): UcpLineItem {
  return {
    id: sku,
    item: {
      id: sku,
      title: sku,
      price: 0,
    },
    quantity,
    totals: [],
  };
}

async function searchCatalog(
  session: ProtocolSession,
  query: string,
  limit: number,
  cursor?: string,
): Promise<UcpSearchResponse> {
  const response = await session.sendJson<UcpSearchResponse>('POST', `${UCP_BASE_URL}/catalog/search`, {
    query,
    pagination: {
      limit,
      ...(cursor ? { cursor } : {}),
    },
  });

  expect(response.status).toBe(200);

  return response.body;
}

async function findSearchResultSkus(session: ProtocolSession): Promise<string[]> {
  const result = await searchCatalog(session, testData.searchTerm, 10);
  expectUcpSuccess(result);

  const skus = (result.products ?? [])
    .flatMap((product) => product.variants)
    .map((variant) => variant.sku ?? variant.id)
    .filter((sku) => !!sku);

  expect(skus.length, 'expected the catalog search to surface purchasable variants').toBeGreaterThan(0);

  return skus;
}

/**
 * Not every variant surfaced by a search index is guaranteed to be purchasable
 * in the backend (missing prices, inventory or region assignments), so journeys
 * walk the results like a shopper would and settle on the first SKUs that the
 * backend accepts into a cart.
 */
async function findAddableSkus(
  session: ProtocolSession,
  candidates: string[],
  count: number,
): Promise<string[]> {
  const addable: string[] = [];
  const failures: string[] = [];

  for (const sku of candidates) {
    if (addable.length >= count) {
      break;
    }

    if (addable.includes(sku)) {
      continue;
    }

    const response = await session.sendJson<UcpCartResponse>('POST', `${UCP_BASE_URL}/carts`, {
      line_items: [toCartLineItem(sku, 1)],
    });

    if (response.status === 201 && response.body.ucp.status === 'success') {
      addable.push(sku);
    } else {
      failures.push(`${sku}: ${describeUcpError(response.body)}`);
    }
  }

  if (addable.length < count) {
    assert.fail(
      `Needed ${count} purchasable SKUs but only found ${addable.length}. Failures: ${failures.join('; ')}`,
    );
  }

  return addable;
}

const combinations = getProtocolBackends().flatMap((backend) =>
  getProtocolSearchEngines().map((search) => ({ backend, search })),
);

describe.each(combinations)('UCP e2e - $backend + $search', ({ backend, search }) => {
  const available = hasBackendEnv(backend) && hasSearchEnv(search);

  describe.skipIf(!available)('shopping flows', () => {
    const server = createUcpServer(backend, search);

    it('discovers the shop profile and searches the catalog', async () => {
      const session = createUcpSession(server);

      // 1. An agent discovers the shop through the well-known UCP profile.
      const profile = await session.get<UcpProfileResponse>('https://shop.example.com/.well-known/ucp');

      expect(profile.status).toBe(200);
      expect(profile.body.ucp.version).toBe('2026-08-25');
      expect(profile.body.ucp.services['dev.ucp.shopping']?.[0]).toMatchObject({
        transport: 'rest',
        endpoint: UCP_BASE_URL,
      });
      expect(profile.body.ucp.capabilities['dev.ucp.shopping.catalog.search']).toBeDefined();
      expect(profile.body.ucp.capabilities['dev.ucp.shopping.cart']).toBeDefined();
      expect(profile.body.ucp.capabilities['dev.ucp.shopping.checkout']).toBeDefined();
      expect(profile.body.ucp.payment_handlers?.['dev.reactionary.manual']).toBeDefined();
      expect(profile.body.merchant.name).toBe('Reactionary e2e shop');

      // 2. It searches the advertised catalog endpoint with a term.
      const byTerm = await searchCatalog(session, testData.searchTerm, 5);
      expectUcpSuccess(byTerm);
      expect(byTerm.products?.length).toBeGreaterThan(0);
      expect(byTerm.pagination?.total_count).toBeGreaterThan(0);

      for (const product of byTerm.products ?? []) {
        expect(product.id).toBeTruthy();
        expect(product.title).toBeTruthy();
      }

      // 3. It drills into one of the results for details.
      const sku = (byTerm.products ?? [])
        .flatMap((product) => product.variants)
        .map((variant) => variant.sku ?? variant.id)
        .find((value) => !!value);
      expect(sku, 'expected at least one search result variant with a SKU').toBeTruthy();

      const detail = await session.sendJson<UcpProductResponse>('POST', `${UCP_BASE_URL}/catalog/product`, {
        id: sku,
      });

      expect(detail.status).toBe(200);
      expectUcpSuccess(detail.body);
      expect(detail.body.product?.id).toBeTruthy();
      expect(detail.body.product?.variants.length).toBeGreaterThan(0);
    }, PROTOCOL_TEST_TIMEOUT);

    it('paginates through catalog search results with cursors', async () => {
      const session = createUcpSession(server);

      const firstPage = await searchCatalog(session, testData.searchTerm, 2);
      expectUcpSuccess(firstPage);
      expect(firstPage.products?.length).toBe(2);
      expect(firstPage.pagination?.has_next_page).toBe(true);
      expect(firstPage.pagination?.cursor).toBeTruthy();

      const secondPage = await searchCatalog(session, testData.searchTerm, 2, firstPage.pagination?.cursor);
      expectUcpSuccess(secondPage);
      expect(secondPage.products?.length).toBeGreaterThan(0);

      const firstPageIds = (firstPage.products ?? []).map((product) => product.id);
      const secondPageIds = (secondPage.products ?? []).map((product) => product.id);
      for (const id of secondPageIds) {
        expect(firstPageIds).not.toContain(id);
      }
    }, PROTOCOL_TEST_TIMEOUT);

    it('carries a search result into a backend cart', async () => {
      const session = createUcpSession(server);

      // Search (through the configured engine) and hand the result over to the
      // commerce backend by creating a cart with the discovered SKU.
      const skus = await findSearchResultSkus(session);
      const [sku] = await findAddableSkus(session, skus, 1);

      const created = await session.sendJson<UcpCartResponse>('POST', `${UCP_BASE_URL}/carts`, {
        line_items: [toCartLineItem(sku, 1)],
      });

      expect(created.status).toBe(201);
      expectUcpSuccess(created.body);
      expect(created.body.id).toBeTruthy();
      expect(created.body.line_items?.length).toBe(1);
      expect(created.body.line_items?.[0].item.id).toBe(sku);
      expect(created.body.currency).toBeTruthy();

      const fetched = await session.get<UcpCartResponse>(`${UCP_BASE_URL}/carts/${created.body.id}`);

      expect(fetched.status).toBe(200);
      expectUcpSuccess(fetched.body);
      expect(fetched.body.id).toBe(created.body.id);
      expect(fetched.body.line_items?.[0].item.id).toBe(sku);
    }, PROTOCOL_TEST_TIMEOUT);

    // The deep cart and checkout journeys exercise the commerce backend, so they
    // only run on the native-search combination to avoid repeating identical
    // backend coverage per search engine.
    describe.skipIf(search !== ProtocolSearchEngine.NATIVE)('backend journeys', () => {
      it('manages a cart through its full lifecycle', async () => {
        const session = createUcpSession(server);
        const candidates = await findSearchResultSkus(session);
        const [firstSku, secondSku] = await findAddableSkus(session, candidates, 2);

        // 1. Create a cart, with an idempotency key the way an agent retries.
        const created = await session.sendJson<UcpCartResponse>(
          'POST',
          `${UCP_BASE_URL}/carts`,
          { line_items: [toCartLineItem(firstSku, 1)] },
          { 'Idempotency-Key': 'ucp-e2e-create-cart' },
        );

        expect(created.status).toBe(201);
        expectUcpSuccess(created.body);
        const cartId = created.body.id;
        expect(cartId).toBeTruthy();

        // 2. A retried request with the same key replays the stored response.
        const replayed = await session.sendJson<UcpCartResponse>(
          'POST',
          `${UCP_BASE_URL}/carts`,
          { line_items: [toCartLineItem(firstSku, 1)] },
          { 'Idempotency-Key': 'ucp-e2e-create-cart' },
        );

        expect(replayed.status).toBe(201);
        expect(replayed.body.id).toBe(cartId);

        // 3. Raise the quantity by replacing the cart contents.
        const raised = await session.sendJson<UcpCartResponse>('PUT', `${UCP_BASE_URL}/carts/${cartId}`, {
          line_items: [toCartLineItem(firstSku, 3)],
        });

        expectUcpSuccess(raised.body);
        expect(raised.body.line_items?.length).toBe(1);
        expect(raised.body.line_items?.[0].quantity).toBe(3);

        // 4. Add a second product.
        const extended = await session.sendJson<UcpCartResponse>('PUT', `${UCP_BASE_URL}/carts/${cartId}`, {
          line_items: [toCartLineItem(firstSku, 3), toCartLineItem(secondSku, 2)],
        });

        expectUcpSuccess(extended.body);
        expect(extended.body.line_items?.length).toBe(2);
        const skusInCart = (extended.body.line_items ?? []).map((lineItem) => lineItem.item.id);
        expect(skusInCart).toContain(firstSku);
        expect(skusInCart).toContain(secondSku);

        // 5. Remove the first product again.
        const reduced = await session.sendJson<UcpCartResponse>('PUT', `${UCP_BASE_URL}/carts/${cartId}`, {
          line_items: [toCartLineItem(secondSku, 2)],
        });

        expectUcpSuccess(reduced.body);
        expect(reduced.body.line_items?.length).toBe(1);
        expect(reduced.body.line_items?.[0].item.id).toBe(secondSku);
        expect(reduced.body.line_items?.[0].quantity).toBe(2);

        // 6. Abandon the purchase.
        const canceled = await session.sendJson<UcpCartResponse>(
          'POST',
          `${UCP_BASE_URL}/carts/${cartId}/cancel`,
          {},
        );

        expect(canceled.status).toBe(200);
        expectUcpSuccess(canceled.body);
      }, PROTOCOL_TEST_TIMEOUT);

      it('completes a browse-to-checkout journey', async () => {
        const session = createUcpSession(server);
        const candidates = await findSearchResultSkus(session);
        const [sku] = await findAddableSkus(session, candidates, 1);

        // 1. Inspect the product before buying.
        const detail = await session.sendJson<UcpProductResponse>('POST', `${UCP_BASE_URL}/catalog/product`, {
          id: sku,
        });
        expectUcpSuccess(detail.body);

        // 2. Put two units in a cart.
        const cart = await session.sendJson<UcpCartResponse>('POST', `${UCP_BASE_URL}/carts`, {
          line_items: [toCartLineItem(sku, 2)],
        });

        expect(cart.status).toBe(201);
        expectUcpSuccess(cart.body);
        const totalEntry = cart.body.totals?.find((total) => total.type === 'total');
        expect(totalEntry?.amount).toBeGreaterThan(0);

        // 3. Open a checkout session for the cart, supplying the buyer contact
        // details and a payment instrument carrying the billing address, the
        // way an agentic platform fills in verified buyer data.
        const checkout = await session.sendJson<UcpCheckoutResponse>(
          'POST',
          `${UCP_BASE_URL}/checkout-sessions`,
          {
            cart_id: cart.body.id,
            buyer: {
              first_name: 'John',
              last_name: 'Doe',
              email: 'sample@example.com',
              phone_number: '+4512345678',
            },
            payment: {
              instruments: [
                {
                  id: 'instrument-1',
                  handler_id: 'manual',
                  type: 'card',
                  selected: true,
                  billing_address: {
                    first_name: 'John',
                    last_name: 'Doe',
                    street_address: '123 Main St',
                    address_locality: 'Anytown',
                    address_region: '',
                    postal_code: '12345',
                    address_country: 'DK',
                  },
                },
              ],
            },
          },
          { 'Idempotency-Key': 'ucp-e2e-create-checkout' },
        );

        expect(checkout.status).toBe(201);
        expectUcpSuccess(checkout.body);
        expect(checkout.body.id).toBeTruthy();
        expect(['incomplete', 'ready_for_complete']).toContain(checkout.body.status ?? '');
        expect(checkout.body.line_items?.length).toBe(1);
        expect(checkout.body.line_items?.[0].item.id).toBe(sku);
        expect(checkout.body.line_items?.[0].quantity).toBe(2);
        expect(checkout.body.ucp.payment_handlers?.['dev.reactionary.manual']).toBeDefined();
        const checkoutTotal = checkout.body.totals?.find((total) => total.type === 'total');
        expect(checkoutTotal?.amount).toBeGreaterThan(0);

        // 4. The agent re-reads the session before asking the buyer to pay.
        const fetched = await session.get<UcpCheckoutResponse>(
          `${UCP_BASE_URL}/checkout-sessions/${checkout.body.id}`,
        );

        expect(fetched.status).toBe(200);
        expectUcpSuccess(fetched.body);
        expect(fetched.body.id).toBe(checkout.body.id);
        expect(fetched.body.line_items?.[0].item.id).toBe(sku);
        // Completing the checkout is not exercised: it requires a real payment
        // service provider interaction, which an unattended e2e test cannot do.
      }, PROTOCOL_TEST_TIMEOUT);
    });
  });
});
