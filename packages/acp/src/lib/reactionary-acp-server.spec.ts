import {
  MemoryCache,
  success,
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
        items: [{ id: 'sku-1', quantity: 2 }],
        buyer: {
          name: 'Ada Lovelace',
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
    expect(created).toMatchObject({
      status: 'ready_for_payment',
      currency: 'eur',
      payment_provider: {
        provider: 'stripe',
        supported_payment_methods: ['card'],
      },
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

    const getResponse = await server.fetch(
      new Request(`http://127.0.0.1/checkout_sessions/${created.id}`),
    );
    await expect(getResponse.json()).resolves.toMatchObject({
      id: created.id,
      status: 'ready_for_payment',
    });

    const completeResponse = await server.fetch(
      jsonRequest(`http://127.0.0.1/checkout_sessions/${created.id}/complete`, {
        buyer: {
          name: 'Ada Lovelace',
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
} = {}): ReactionaryACPClient {
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
        const initPayload = payload as { cart: Cart };
        const checkout = createCheckout(
          `checkout-${checkoutCounter}`,
          initPayload.cart,
        );
        checkouts.set(checkout.identifier.key, checkout);
        return success(checkout);
      },
      async getById(payload) {
        const getPayload = payload as { identifier: { key: string } };
        return success(
          checkouts.get(getPayload.identifier.key) ??
            createCheckout('missing', createCart('missing', [])),
        );
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
    },
    body: JSON.stringify(body),
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}
