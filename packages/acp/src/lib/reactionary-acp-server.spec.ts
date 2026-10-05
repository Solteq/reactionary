import {
  MemoryCache,
  error,
  success,
  type GenericError,
  type Cart,
  type Checkout,
  type Inventory,
  type Price,
  type Product,
  type ProductSearchResult,
  type RequestContext,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import {
  ReactionaryACPServer,
  type ReactionaryACPClient,
} from './reactionary-acp-server.js';

describe('ReactionaryACPServer', () => {
  it('does not initialize when the client is missing required operations', () => {
    expect(
      () => new ReactionaryACPServer(() => ({}) as ReactionaryACPClient),
    ).toThrow(
      'Reactionary ACP server cannot initialize because the client is missing required operations',
    );
  });

  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryACPServer(() => createTestClient());

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('serves an ACP readiness response', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      name: 'test-acp',
      version: '1.2.3',
    });

    const response = await server.fetch(new Request('http://127.0.0.1/acp'));
    const body = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('acp-session-id')).toBeTruthy();
    expect(body).toMatchObject({
      name: 'test-acp',
      version: '1.2.3',
      protocol: 'acp',
      status: 'ready',
    });
    expect(body['actions']).toEqual(
      expect.arrayContaining([
        'POST /checkout_sessions',
        'POST /checkout_sessions/{checkout_session_id}/complete',
      ]),
    );
  });

  it('serves an ACP discovery document at the well-known paths', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());

    for (const path of ['/.well-known/acp.json', '/.well-known/acp']) {
      const response = await server.fetch(new Request(`https://shop.example.com${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
      expect(await json<Record<string, unknown>>(response)).toEqual({
        protocol: {
          name: 'acp',
          version: '2026-04-17',
          supported_versions: ['2026-04-17'],
        },
        api_base_url: 'https://shop.example.com/acp',
        transports: ['rest'],
        capabilities: { services: ['checkout'] },
      });
    }
  });

  it('honours discovery options and omits the HEAD body', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      discovery: {
        apiBaseUrl: 'https://api.example.com/acp',
        supportedCurrencies: ['EUR'],
      },
    });

    const response = await server.fetch(
      new Request('https://shop.example.com/.well-known/acp.json'),
    );
    expect(await json<Record<string, unknown>>(response)).toMatchObject({
      api_base_url: 'https://api.example.com/acp',
      protocol: { supported_versions: ['2026-04-17'] },
      capabilities: { supported_currencies: ['EUR'] },
    });

    const head = await server.fetch(
      new Request('https://shop.example.com/.well-known/acp.json', { method: 'HEAD' }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('rejects checkout requests without a supported API-Version', async () => {
    const server = new ReactionaryACPServer(() => createTestClient());
    const body = JSON.stringify({ line_items: [{ id: 'sku-1', quantity: 1 }], currency: 'eur' });

    const missing = await server.fetch(new Request('http://127.0.0.1/checkout_sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));

    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      type: 'invalid_request',
      code: 'missing_api_version',
      message: 'The API-Version header is required.',
      supported_versions: ['2026-04-17'],
    });

    const unsupported = await server.fetch(new Request('http://127.0.0.1/checkout_sessions/checkout_session_1', {
      headers: { 'api-version': '2025-09-29' },
    }));

    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({
      code: 'unsupported_api_version',
      supported_versions: ['2026-04-17'],
    });
  });

  it('persists request context session state by ACP session id', async () => {
    const observedSessions: RequestContext['session'][] = [];
    const server = new ReactionaryACPServer(
      (requestContext) => {
        observedSessions.push({ ...requestContext.session });
        requestContext.session['test.marker'] = 'saved';
        return createTestClient();
      },
      { sessionCache: new MemoryCache() },
    );

    const first = await server.fetch(new Request('http://127.0.0.1/acp'));
    const sessionId = first.headers.get('acp-session-id');

    expect(sessionId).toBeTruthy();

    await server.fetch(
      new Request('http://127.0.0.1/acp', {
        headers: {
          'acp-session-id': sessionId ?? '',
        },
      }),
    );

    expect(observedSessions[2]?.['test.marker']).toBe('saved');
  });

  it('creates, retrieves, and completes ACP checkout sessions', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), {
      sessionCache: new MemoryCache(),
    });

    const createResponse = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 2 }],
        currency: 'eur',
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
        },
        fulfillment_address: {
          name: 'Ada Lovelace',
          line_one: '1 Computing Street',
          city: 'London',
          state: 'London',
          country: 'GB',
          postal_code: 'SW1A 1AA',
        },
      }),
    );
    const created = await json<{ id: string }>(createResponse);

    expect(createResponse.status).toBe(201);
    // Payable only once a fulfillment option has been picked.
    expect(created).toMatchObject({
      status: 'not_ready_for_payment',
      currency: 'eur',
      payment_provider: {
        provider: 'stripe',
        supported_payment_methods: ['card'],
      },
      fulfillment_options: [{ id: 'standard' }],
      line_items: [
        {
          item: {
            id: 'sku-1',
            quantity: 2,
          },
          total: 2000,
        },
      ],
    });

    const updateResponse = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        fulfillment_option_id: 'standard',
      }),
    );
    await expect(updateResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: 'ready_for_payment',
      fulfillment_option_id: 'standard',
    });

    const getResponse = await server.fetch(
      getRequest(`http://127.0.0.1/checkout_sessions/${created.id}`),
    );
    await expect(getResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: 'ready_for_payment',
    });

    const completeResponse = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
        },
        payment_data: {
          token: 'spt_test',
          provider: 'stripe',
        },
      }),
    );
    const completed = await json<Record<string, unknown>>(completeResponse);

    expect(completeResponse.status).toBe(200);
    expect(completed).toMatchObject({
      id: created.id,
      status: 'completed',
      order: {
        checkout_session_id: created.id,
      },
    });
  });

  it('adds up requested quantities, accepts decimals and prices in the requested currency', async () => {
    const currencies: string[] = [];
    const server = new ReactionaryACPServer((requestContext) => {
      currencies.push(requestContext.languageContext.currencyCode);
      return createTestClient();
    }, { sessionCache: new MemoryCache() });

    const response = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }, { id: 'sku-1', quantity: 1.5 }],
        currency: 'sek',
      }),
    );
    const created = await json<{ id: string }>(response);

    expect(response.status).toBe(201);
    expect(created).toMatchObject({
      line_items: [{ item: { id: 'sku-1', quantity: 2.5 } }],
    });

    await server.fetch(getRequest(`http://127.0.0.1/checkout_sessions/${created.id}`));

    expect(currencies.slice(1)).toEqual(['SEK', 'SEK']);
  });

  it('accepts the 2026-04-17 buyer and merges buyer updates', async () => {
    const server = new ReactionaryACPServer(() => createTestClient(), { sessionCache: new MemoryCache() });
    const created = await json<{ id: string; buyer: unknown }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        buyer: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          account_type: 'business',
          company: { name: 'Analytical Engines Ltd', tax_id: 'GB123' },
        },
      }),
    ));

    expect(created.buyer).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      account_type: 'business',
      company: { name: 'Analytical Engines Ltd', tax_id: 'GB123' },
    });

    const updated = await json<{ buyer: unknown }>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        buyer: { email: 'ada@engines.example', phone_number: '+441234567890' },
      }),
    ));

    expect(updated.buyer).toMatchObject({
      first_name: 'Ada',
      email: 'ada@engines.example',
      phone_number: '+441234567890',
    });

    const invalid = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, { buyer: { first_name: 'Ada' } }),
    );

    expect(invalid.status).toBe(400);
  });

  it('creates a session without buyer data and no backend checkout', async () => {
    const initiated: unknown[] = [];
    const server = new ReactionaryACPServer(() => createTestClient({ initiated }), {
      sessionCache: new MemoryCache(),
    });

    const response = await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: 'not_ready_for_payment',
      fulfillment_options: [],
      line_items: [{ item: { id: 'sku-1', quantity: 1 } }],
    });
    expect(initiated).toEqual([]);
  });

  it('prices with a placeholder email and stays in progress until the payment is authorized', async () => {
    const initiated: unknown[] = [];
    const notReady = new Set<string>(['all']);
    const server = new ReactionaryACPServer(() => createTestClient({ initiated, notReady }), {
      sessionCache: new MemoryCache(),
      paymentAuthorizationWait: { timeoutMs: 0 },
    });
    const address = {
      name: 'Ada Lovelace',
      line_one: '1 Computing Street',
      city: 'London',
      state: 'London',
      country: 'GB',
      postal_code: 'SW1A 1AA',
    };

    const created = await json<{ id: string; status: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        fulfillment_address: address,
      }),
    ));

    expect(created.status).toBe('not_ready_for_payment');
    expect(initiated).toEqual(['pending@checkout.invalid']);

    await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, {
        fulfillment_option_id: 'standard',
      }),
    );

    const payload = {
      buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      payment_data: { token: 'spt_test', provider: 'stripe' },
    };
    const pending = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, payload),
    ));

    expect(pending, JSON.stringify(pending)).toMatchObject({ status: 'in_progress' });
    expect(initiated.at(-1)).toBe('ada@example.com');

    notReady.clear();
    const completed = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, payload),
    ));

    expect(completed).toMatchObject({
      status: 'completed',
      order: { id: 'order-1', checkout_session_id: created.id },
    });
  });

  it('waits for an asynchronous payment authorization before answering', async () => {
    const notReady = new Set<string>(['all']);
    const server = new ReactionaryACPServer(() => createTestClient({ notReady }), {
      sessionCache: new MemoryCache(),
      paymentAuthorizationWait: { timeoutMs: 2_000, intervalMs: 10 },
    });
    const created = await json<{ id: string }>(await server.fetch(
      jsonRequest('http://127.0.0.1/checkout_sessions', {
        line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
        fulfillment_address: {
          name: 'Ada Lovelace',
          line_one: '1 Computing Street',
          city: 'London',
          state: 'London',
          country: 'GB',
          postal_code: 'SW1A 1AA',
        },
      }),
    ));
    await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, { fulfillment_option_id: 'standard' }),
    );

    // The PSP webhook records the authorization while completion is waiting.
    setTimeout(() => notReady.clear(), 50);

    const completed = await json<Record<string, unknown>>(await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
        buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
        payment_data: { token: 'spt_test', provider: 'stripe' },
      }),
    ));

    expect(completed).toMatchObject({ status: 'completed' });
  });

  it('passes the delegated token verbatim and reports declines', async () => {
    const payments: unknown[] = [];
    const createServer = (declinePayments: boolean) => new ReactionaryACPServer(
      () => createTestClient({ payments, declinePayments }),
      { sessionCache: new MemoryCache(), paymentAuthorizationWait: { timeoutMs: 0 } },
    );
    const openSession = async (server: ReactionaryACPServer) => {
      const created = await json<{ id: string }>(await server.fetch(
        jsonRequest('http://127.0.0.1/checkout_sessions', {
          line_items: [{ id: 'sku-1', quantity: 1 }],
        currency: 'eur',
          buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
          fulfillment_address: {
            name: 'Ada Lovelace',
            line_one: '1 Computing Street',
            city: 'London',
            state: 'London',
            country: 'GB',
            postal_code: 'SW1A 1AA',
          },
        }),
      ));
      await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}`, { fulfillment_option_id: 'standard' }));
      return created.id;
    };
    const complete = { payment_data: { token: 'spt_123', provider: 'stripe' } };

    const server = createServer(false);
    await server.fetch(jsonRequest(`http://127.0.0.1/checkout_sessions/${await openSession(server)}/complete`, complete));

    expect(payments[0]).toMatchObject({
      paymentInstruction: {
        protocolData: [
          { key: 'delegated_payment_token', value: 'spt_123' },
          { key: 'delegated_payment_provider', value: 'stripe' },
        ],
      },
    });

    const declining = createServer(true);
    const declined = await declining.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${await openSession(declining)}/complete`, complete),
    );

    expect(declined.status).toBe(400);
    await expect(declined.json()).resolves.toMatchObject({ code: 'payment_declined' });
  });

  it('streams generated product feeds as JSONL', async () => {
    const observedLanguageContexts: RequestContext['languageContext'][] = [];
    const observedSearches: unknown[] = [];
    const server = new ReactionaryACPServer((requestContext) => {
      observedLanguageContexts.push({ ...requestContext.languageContext });
      return createTestClient({ observedSearches });
    }, {
      productFeed: {
        feeds: {
          finnish: {
            languageContext: {
              locale: 'fi-FI',
              currencyCode: 'EUR',
            },
            search: {
              term: 'shoes',
              facets: [],
              filters: ['market:fi'],
              paginationOptions: {
                pageNumber: 1,
                pageSize: 25,
              },
            },
            productUrlBase: 'https://shop.example/{lang}/products/{slug}',
          },
        },
      },
    });

    const response = await server.fetch(
      new Request(
        'http://127.0.0.1/product_feeds/finnish/products?format=jsonl',
      ),
    );
    const lines = (await response.text()).trim().split('\n');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      item_id: 'sku-1',
      title: 'Test variant',
      url: 'https://shop.example/fi/products/test-product',
      availability: 'in_stock',
      price: '10.00 EUR',
    });
    expect(observedLanguageContexts[1]).toEqual({
      locale: 'fi-FI',
      currencyCode: 'EUR',
    });
    expect(observedSearches[0]).toMatchObject({
      term: 'shoes',
      filters: ['market:fi'],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 25,
      },
    });
  });
});

function createTestClient(options: {
  observedSearches?: unknown[];
  initiated?: unknown[];
  notReady?: Set<string>;
  payments?: unknown[];
  declinePayments?: boolean;
} = {}): ReactionaryACPClient {
  const withReadiness = (checkout: Checkout): Checkout => ({
    ...checkout,
    readyForFinalization: !options.notReady?.has('all'),
  });
  let cartCounter = 0;
  let checkoutCounter = 0;
  const carts = new Map<string, Cart>();
  const checkouts = new Map<string, Checkout>();

  return {
    cart: {
      async createCart() {
        cartCounter += 1;
        const cart = createCart(`cart-${cartCounter}`, []);
        carts.set(cart.identifier.key, cart);
        return success(cart);
      },
      async add(payload) {
        const addPayload = payload as {
          cart: { key: string };
          variant: { sku: string };
          quantity: number;
        };
        const cart = carts.get(addPayload.cart.key) ?? createCart(
          addPayload.cart.key,
          [],
        );
        const updated = createCart(cart.identifier.key, [
          ...cart.items.map((item) => ({
            sku: item.variant.sku,
            quantity: item.quantity,
          })),
          {
            sku: addPayload.variant.sku,
            quantity: addPayload.quantity,
          },
        ]);
        carts.set(updated.identifier.key, updated);
        return success(updated);
      },
      async getById(payload) {
        const getPayload = payload as { cart: { key: string } };
        return success(carts.get(getPayload.cart.key) ?? createCart('missing', []));
      },
    },
    checkout: {
      async initiateCheckoutForCart(payload) {
        checkoutCounter += 1;
        const initPayload = payload as { cart: Cart; notificationEmail?: string };
        options.initiated?.push(initPayload.notificationEmail);
        const checkout = createCheckout(
          `checkout-${checkoutCounter}`,
          initPayload.cart,
        );
        checkouts.set(checkout.identifier.key, checkout);
        return success(checkout);
      },
      async getById(payload) {
        const getPayload = payload as { identifier: { key: string } };
        return success(withReadiness(
          checkouts.get(getPayload.identifier.key) ??
            createCheckout('missing', createCart('missing', [])),
        ));
      },
      async setShippingAddress(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async getAvailableShippingMethods() {
        return success([
          {
            identifier: { key: 'standard' },
            name: 'Standard shipping',
            description: 'Ships soon',
            price: { value: 5, currency: 'EUR' },
            deliveryTime: '3-5 business days',
            carrier: 'Reactionary',
          },
        ]);
      },
      async getAvailablePaymentMethods() {
        return success([
          {
            identifier: {
              method: 'card',
              name: 'Stripe',
              paymentProcessor: 'stripe',
            },
            description: 'Stripe card payment',
            isPunchOut: false,
          },
        ]);
      },
      async setShippingInstruction(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async addPaymentInstruction(payload) {
        options.payments?.push(payload);
        if (options.declinePayments) {
          return error<GenericError>({ type: 'Generic', message: 'card declined' });
        }
        const checkout = getCheckoutFromPayload(checkouts, payload);
        return success(checkout);
      },
      async finalizeCheckout(payload) {
        const checkout = getCheckoutFromPayload(checkouts, payload);
        const finalized = {
          ...checkout,
          resultingOrder: { key: 'order-1' },
        };
        checkouts.set(finalized.identifier.key, finalized);
        return success(finalized);
      },
    },
    productSearch: {
      async queryByTerm(payload) {
        options.observedSearches?.push((payload as { search: unknown }).search);
        return success(createProductSearchResult());
      },
    },
    product: {
      async getBySKU() {
        return success(createProduct());
      },
    },
    price: {
      async getListPrice() {
        return success(createPrice(10));
      },
      async getCustomerPrice() {
        return success(createPrice(8));
      },
    },
    inventory: {
      async getBySKU() {
        return success(createInventory());
      },
    },
  };
}

function createCart(
  id: string,
  items: Array<{ sku: string; quantity: number }>,
): Cart {
  const total = items.reduce((sum, item) => sum + item.quantity * 10, 0);

  return {
    identifier: { key: id },
    user: { userId: '' },
    name: '',
    items: items.map((item, index) => ({
      identifier: { key: `line-${index + 1}` },
      product: { key: item.sku },
      variant: { sku: item.sku },
      quantity: item.quantity,
      price: {
        unitPrice: { value: 10, currency: 'EUR' },
        unitDiscount: { value: 0, currency: 'EUR' },
        totalPrice: { value: item.quantity * 10, currency: 'EUR' },
        totalDiscount: { value: 0, currency: 'EUR' },
      },
    })),
    price: {
      totalTax: { value: 0, currency: 'EUR' },
      totalDiscount: { value: 0, currency: 'EUR' },
      totalSurcharge: { value: 0, currency: 'EUR' },
      totalShipping: { value: 0, currency: 'EUR' },
      totalProductPrice: { value: total, currency: 'EUR' },
      grandTotal: { value: total, currency: 'EUR' },
    },
    appliedPromotions: [],
    description: '',
  };
}

function createCheckout(id: string, cart: Cart): Checkout {
  return {
    identifier: { key: id },
    originalCartReference: cart.identifier,
    items: cart.items.map((item) => ({
      identifier: { key: item.identifier.key },
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
    })),
    price: cart.price,
    name: '',
    description: '',
    pointOfContact: {
      email: 'ada@example.com',
    },
    billingAddress: null,
    paymentInstructions: [],
    readyForFinalization: true,
  };
}

function createProductSearchResult(): ProductSearchResult {
  return {
    identifier: {
      term: '',
      facets: [],
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 50,
      },
    },
    pageNumber: 1,
    pageSize: 50,
    totalCount: 1,
    totalPages: 1,
    facets: [],
    items: [
      {
        identifier: { key: 'product-1' },
        name: 'Test product',
        slug: 'test-product',
        variants: [
          {
            variant: { sku: 'sku-1' },
            image: {
              sourceUrl: 'https://cdn.example/sku-1.png',
              altText: 'Test variant',
            },
          },
        ],
      },
    ],
  };
}

function createProduct(): Product {
  return {
    identifier: { key: 'product-1' },
    name: 'Test product',
    slug: 'test-product',
    description: 'Short description',
    longDescription: 'Long description',
    brand: 'Reactionary',
    manufacturer: 'Reactionary',
    parentCategories: [],
    published: true,
    sharedAttributes: [],
    options: [],
    mainVariant: {
      identifier: { sku: 'sku-1' },
      name: 'Test variant',
      images: [
        {
          sourceUrl: 'https://cdn.example/sku-1.png',
          altText: 'Test variant',
        },
      ],
      ean: '',
      gtin: '',
      upc: '',
      barcode: '',
      options: [],
    },
    variants: [],
  };
}

function createPrice(value: number): Price {
  return {
    identifier: {
      variant: { sku: 'sku-1' },
    },
    unitPrice: {
      value,
      currency: 'EUR',
    },
    onSale: false,
    tieredPrices: [],
  };
}

function createInventory(): Inventory {
  return {
    identifier: {
      variant: { sku: 'sku-1' },
      fulfillmentCenter: { key: '' },
    },
    quantity: 5,
    status: 'inStock',
  };
}

function getCheckoutFromPayload(
  checkouts: Map<string, Checkout>,
  payload: unknown,
): Checkout {
  const checkoutPayload = payload as { checkout: { key: string } };
  return (
    checkouts.get(checkoutPayload.checkout.key) ??
    createCheckout('missing', createCart('missing', []))
  );
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-version': '2026-04-17',
    },
    body: JSON.stringify(body),
  });
}

function getRequest(url: string): Request {
  return new Request(url, {
    headers: {
      'api-version': '2026-04-17',
    },
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}
