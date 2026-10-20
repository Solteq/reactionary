import {
  MemoryCache,
  error,
  success,
  type Cart,
  type Checkout,
  type GenericError,
  type Order,
} from '@reactionary/core';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createTokenizedCardHandler } from './acp-payment-handlers.js';
import {
  ReactionaryACPServer,
  createBearerTokenAuthenticator,
  type ReactionaryACPClient,
  type ReactionaryACPServerOptions,
} from './reactionary-acp-server.js';

/**
 * Validates the adapter's output against the official ACP 2026-04-17 JSON
 * Schemas (vendored in __fixtures__), and checks that the specification's
 * own example requests are accepted.
 */
const FIXTURES = new URL('./__fixtures__/acp-spec-2026-04-17/', import.meta.url);
const checkoutSchema = loadJson('schema.agentic_checkout.json');
const cartSchema = loadJson('schema.cart.json');
const examples = loadJson('examples.agentic_checkout.json');

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(checkoutSchema);
// The cart schema refers to `schema.agentic_checkout.json` relative to its
// own $id, so the checkout schema is also registered under that URL.
ajv.addSchema({ ...checkoutSchema, $id: new URL('schema.agentic_checkout.json', String(cartSchema['$id'])).href });
ajv.addSchema(cartSchema);

const CHECKOUT_ID = String(checkoutSchema['$id']);
const CART_ID = String(cartSchema['$id']);

function validator(schemaId: string, definition: string): ValidateFunction {
  const validate = ajv.getSchema(`${schemaId}#/$defs/${definition}`);

  if (!validate) {
    throw new Error(`Unknown schema definition: ${definition}`);
  }

  return validate;
}

function expectValid(definition: string, value: unknown, schemaId = CHECKOUT_ID): void {
  const validate = validator(schemaId, definition);
  const valid = validate(value);

  expect(valid, `${definition}: ${ajv.errorsText(validate.errors, { separator: '\n' })}\n${JSON.stringify(value, null, 2)}`).toBe(true);
}

const paymentHandlers = [createTokenizedCardHandler({ psp: 'stripe', merchantId: 'acct_123', displayName: 'Credit Card' })];
const address = {
  name: 'Ada Lovelace',
  line_one: '1 Computing Street',
  city: 'London',
  state: 'London',
  country: 'GB',
  postal_code: 'SW1A 1AA',
};

describe('ACP 2026-04-17 schema conformance', () => {
  it('produces schema-valid checkout sessions through the whole lifecycle', async () => {
    const harness = createHarness({ notReady: true });
    const created = await harness.post('/checkout_sessions', {
      line_items: [{ id: 'sku-1', quantity: 2 }],
      currency: 'eur',
      capabilities: { interventions: { supported: ['3ds'] }, extensions: ['discount'] },
      discounts: { codes: ['SAVE10', 'BOGUS'] },
    });

    expect(created.status).toBe(201);
    expectValid('CheckoutSession', created.body);

    const id = String(created.body['id']);
    const withDetails = await harness.post(`/checkout_sessions/${id}`, {
      buyer: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
      fulfillment_details: { name: 'Ada Lovelace', email: 'ada@example.com', address },
    });

    expectValid('CheckoutSession', withDetails.body);

    const ready = await harness.post(`/checkout_sessions/${id}`, {
      selected_fulfillment_options: [{ type: 'shipping', option_id: 'standard', item_ids: [] }],
    });

    expect(ready.body['status']).toBe('ready_for_payment');
    expectValid('CheckoutSession', ready.body);
    expectValid('CheckoutSession', (await harness.get(`/checkout_sessions/${id}`)).body);

    const pending = await harness.post(`/checkout_sessions/${id}/complete`, {
      payment_data: { handler_id: 'card_tokenized', instrument: { type: 'card', credential: { type: 'spt', token: 'spt_1' } } },
    });

    expect(pending.body['status']).toBe('complete_in_progress');
    expectValid('CheckoutSession', pending.body);

    // The PSP authorizes; completing again (new Idempotency-Key) finalizes.
    harness.authorize();
    const completed = await harness.post(`/checkout_sessions/${id}/complete`, {
      payment_data: { handler_id: 'card_tokenized', instrument: { type: 'card', credential: { type: 'spt', token: 'spt_1' } } },
    });

    expect(completed.body['status']).toBe('completed');
    expectValid('CheckoutSessionWithOrder', completed.body);
  });

  it('rejects sessions that drift from the schema (negative control)', async () => {
    const harness = createHarness({});
    const session = (await harness.post('/checkout_sessions', {
      line_items: [{ id: 'sku-1' }],
      currency: 'eur',
      capabilities: { interventions: { supported: [] } },
    })).body;
    const validate = validator(CHECKOUT_ID, 'CheckoutSession');

    expect(validate(session)).toBe(true);
    // Fields removed in 2025-12-12, string amounts and missing totals fail.
    expect(validate({ ...session, fulfillment_address: address })).toBe(false);
    expect(validate({ ...session, totals: [{ type: 'total', display_text: 'Total', amount: '10.00' }] })).toBe(false);
    expect(validate({ ...session, line_items: [{ id: 'line-1', item: { id: 'sku-1' }, quantity: 1 }] })).toBe(false);
  });

  it('produces schema-valid authentication_required, declined and canceled sessions', async () => {
    const harness = createHarness({
      declinePayments: true,
      options: {
        authentication: {
          getMetadata: () => ({
            acquirer_details: { acquirer_bin: '123456', acquirer_country: 'US', acquirer_merchant_id: 'merchant_123', merchant_name: 'Example Store' },
            directory_server: 'visa',
          }),
        },
      },
    });
    const id = await harness.readySession();
    const payment = { handler_id: 'card_tokenized', instrument: { type: 'card', credential: { type: 'spt', token: 'spt_1' } } };

    const authentication = await harness.post(`/checkout_sessions/${id}/complete`, { payment_data: payment });

    expect(authentication.body['status']).toBe('authentication_required');
    expectValid('CheckoutSession', authentication.body);

    const declined = await harness.post(`/checkout_sessions/${id}/complete`, {
      payment_data: payment,
      authentication_result: {
        outcome: 'authenticated',
        outcome_details: { three_ds_cryptogram: 'AbCdEfGhIjKlMnOpQrStUvWxY0=', electronic_commerce_indicator: '05', transaction_id: 'ds_1', version: '2.2.0' },
      },
    });

    expect(declined.body['messages']).toContainEqual(expect.objectContaining({ code: 'payment_declined' }));
    expectValid('CheckoutSession', declined.body);

    const canceled = await harness.post(`/checkout_sessions/${id}/cancel`, { intent_trace: { reason_code: 'payment_options' } });

    expect(canceled.body['status']).toBe('canceled');
    expectValid('CheckoutSession', canceled.body);
  });

  it('produces schema-valid errors', async () => {
    const harness = createHarness({ options: { authenticate: createBearerTokenAuthenticator({ agent: 'token' }) } });
    const errors = [
      await harness.post('/checkout_sessions', {}, { 'api-version': '' }),
      await harness.post('/checkout_sessions', { line_items: [] }),
      await harness.post('/checkout_sessions', { line_items: [{ id: 'sku-1' }], currency: 'eur', capabilities: {} }, { 'idempotency-key': '' }),
      await harness.get('/checkout_sessions/checkout_session_missing'),
      await harness.get('/checkout_sessions/checkout_session_missing', { authorization: 'Bearer wrong' }),
    ];

    expect(errors.map((error) => error.status)).toEqual([400, 400, 400, 404, 401]);
    for (const error of errors) {
      expectValid('Error', error.body);
    }
  });

  it('produces a schema-valid discovery document', async () => {
    const harness = createHarness({
      options: {
        mcp: true,
        interventions: { supported: ['3ds'] },
        discovery: { documentationUrl: 'https://shop.example/acp', supportedCurrencies: ['eur'], supportedLocales: ['en-GB'] },
        webhooks: { endpoints: [{ url: 'https://agent.example/order_events', secret: 'secret' }], fetch: async () => new Response(null) },
      },
    });

    expectValid('DiscoveryResponse', (await harness.get('/.well-known/acp.json', {}, true)).body);
  });

  it('produces schema-valid carts', async () => {
    const harness = createHarness({});
    const created = await harness.post('/carts', { line_items: [{ id: 'sku-1', quantity: 2 }], buyer: { email: 'ada@example.com' } });

    expect(created.status).toBe(201);
    expectValid('Cart', created.body, CART_ID);

    const updated = await harness.send('PUT', `/carts/${String(created.body['id'])}`, { line_items: [{ id: 'sku-1', quantity: 1 }] });

    expectValid('Cart', updated.body, CART_ID);
  });

  it('sends schema-valid orders in webhooks', async () => {
    const events: Array<{ type: string; data: unknown }> = [];
    const harness = createHarness({
      options: {
        orderPermalinkUrl: 'https://shop.example/orders/{orderId}',
        webhooks: {
          endpoints: [{ url: 'https://agent.example/order_events', secret: 'secret' }],
          fetch: async (_input, init) => {
            events.push(JSON.parse(String(init?.body)));
            return new Response(null);
          },
        },
      },
    });
    const id = await harness.readySession();

    harness.authorize();
    await harness.post(`/checkout_sessions/${id}/complete`, {
      payment_data: { handler_id: 'card_tokenized', instrument: { type: 'card', credential: { type: 'spt', token: 'spt_1' } } },
    });
    await vi.waitFor(() => expect(events).toHaveLength(1));

    expect(['order_create', 'order_update']).toContain(events[0]?.type);
    expectValid('Order', events[0]?.data);
  });

  it('accepts the specification example requests', async () => {
    const requests = Object.entries(examples).filter(([name]) => name.includes('_request'));
    const statuses: Record<string, number> = {};

    for (const [name, body] of requests) {
      const harness = createHarness({ options: { interventions: { supported: ['3ds', 'address_verification'] } } });
      const isCreate = name.startsWith('create_');
      const id = isCreate ? undefined : await harness.readySession();
      const path = isCreate
        ? '/checkout_sessions'
        : name.startsWith('update_') ? `/checkout_sessions/${id}`
          : name.startsWith('cancel_') ? `/checkout_sessions/${id}/cancel`
            : `/checkout_sessions/${id}/complete`;

      statuses[name] = (await harness.post(path, body)).status;
    }

    // Every example parses; completions may still be refused for business
    // reasons (e.g. an authentication result for a session that needs none
    // completes normally, a seller-backed handler that is not offered).
    // Every example is accepted, except a completion with the example's
    // seller-backed handler, which this test server does not offer.
    expect(Object.entries(statuses).filter(([, status]) => status >= 300)).toEqual([
      ['complete_checkout_session_request_seller_backed', 400],
    ]);
    expect(Object.keys(statuses)).toHaveLength(10);
  });
});

function loadJson(name: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${name}`);
  }

  return Object.fromEntries(Object.entries(value));
}

interface HarnessResponse {
  status: number;
  body: Record<string, unknown>;
}

function createHarness(config: {
  notReady?: boolean;
  declinePayments?: boolean;
  options?: Partial<ReactionaryACPServerOptions>;
}) {
  const state = { authorized: !config.notReady };
  const client = createConformanceClient(state, config.declinePayments ?? false);
  const server = new ReactionaryACPServer(() => client, {
    sessionCache: new MemoryCache(),
    paymentHandlers,
    paymentAuthorizationWait: { timeoutMs: 0 },
    orderPermalinkUrl: 'https://shop.example/orders/{orderId}',
    links: [{ type: 'terms_of_use', url: 'https://shop.example/terms' }],
    ...config.options,
  });

  const send = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    /** Origin-relative, e.g. the well-known discovery document. */
    atOrigin = false,
  ): Promise<HarnessResponse> => {
    const response = await server.fetch(new Request(`https://shop.example${atOrigin ? '' : '/acp'}${path}`, {
      method,
      headers: {
        'api-version': '2026-04-17',
        authorization: 'Bearer token',
        ...(method === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    const value: unknown = await response.json();

    return {
      status: response.status,
      body: typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {},
    };
  };

  return {
    send,
    get: (path: string, headers?: Record<string, string>, atOrigin?: boolean) => send('GET', path, undefined, headers, atOrigin),
    post: (path: string, body: unknown, headers?: Record<string, string>) => send('POST', path, body, headers),
    authorize: () => {
      state.authorized = true;
    },
    /** A session with buyer, address and shipping: ready for payment. */
    async readySession(): Promise<string> {
      const created = await send('POST', '/checkout_sessions', {
        line_items: [{ id: 'sku-1' }],
        currency: 'eur',
        capabilities: { interventions: { supported: ['3ds'] } },
        buyer: { email: 'ada@example.com' },
        fulfillment_details: { name: 'Ada Lovelace', address },
      });
      const id = String(created.body['id']);

      await send('POST', `/checkout_sessions/${id}`, {
        selected_fulfillment_options: [{ type: 'shipping', option_id: 'standard', item_ids: [] }],
      });

      return id;
    },
  };
}

/** A small in-memory backend covering everything the adapter can call. */
function createConformanceClient(state: { authorized: boolean }, declinePayments: boolean): ReactionaryACPClient {
  const carts = new Map<string, Cart>();
  const checkouts = new Map<string, Checkout>();
  let counter = 0;
  const keyOf = (payload: unknown, field: string): string => {
    const reference: unknown = typeof payload === 'object' && payload !== null ? Reflect.get(payload, field) : undefined;
    const key: unknown = typeof reference === 'object' && reference !== null ? Reflect.get(reference, 'key') : undefined;
    return typeof key === 'string' ? key : '';
  };
  const numberOf = (payload: unknown, field: string): number => {
    const value: unknown = typeof payload === 'object' && payload !== null ? Reflect.get(payload, field) : undefined;
    return typeof value === 'number' ? value : 1;
  };
  const stringOf = (payload: unknown, ...path: string[]): string => {
    let value: unknown = payload;
    for (const field of path) {
      value = typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
    }
    return typeof value === 'string' ? value : '';
  };
  const store = (cart: Cart) => {
    carts.set(cart.identifier.key, cart);
    return success(cart);
  };

  return {
    cart: {
      createCart: async () => store(conformanceCart(`cart-${++counter}`, [])),
      add: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart(keyOf(payload, 'cart'), []);
        return store(conformanceCart(cart.identifier.key, [
          ...cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity })),
          { sku: stringOf(payload, 'variant', 'sku'), quantity: numberOf(payload, 'quantity') },
        ], cart.appliedPromotions.length > 0));
      },
      getById: async (payload) => success(carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', [])),
      deleteCart: async (payload) => {
        carts.delete(keyOf(payload, 'cart'));
        return success(undefined);
      },
      changeQuantity: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', []);
        const itemKey = keyOf(payload, 'item');
        return store(conformanceCart(cart.identifier.key, cart.items.map((item) => ({
          sku: item.variant.sku,
          quantity: item.identifier.key === itemKey ? numberOf(payload, 'quantity') : item.quantity,
        })), cart.appliedPromotions.length > 0));
      },
      remove: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', []);
        const itemKey = keyOf(payload, 'item');
        return store(conformanceCart(cart.identifier.key, cart.items
          .filter((item) => item.identifier.key !== itemKey)
          .map((item) => ({ sku: item.variant.sku, quantity: item.quantity })), cart.appliedPromotions.length > 0));
      },
      applyCouponCode: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', []);
        return stringOf(payload, 'couponCode').toUpperCase() === 'SAVE10'
          ? store(conformanceCart(cart.identifier.key, cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity })), true))
          : error<GenericError>({ type: 'Generic', message: 'unknown code' });
      },
      removeCouponCode: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', []);
        return store(conformanceCart(cart.identifier.key, cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity }))));
      },
    },
    checkout: {
      initiateCheckoutForCart: async (payload) => {
        const cart = carts.get(keyOf(payload, 'cart')) ?? conformanceCart('missing', []);
        const checkout = conformanceCheckout(`checkout-${++counter}`, cart);
        checkouts.set(checkout.identifier.key, checkout);
        return success(checkout);
      },
      getById: async (payload) => {
        const checkout = checkouts.get(keyOf(payload, 'identifier')) ?? conformanceCheckout('missing', conformanceCart('missing', []));
        return success({ ...checkout, readyForFinalization: state.authorized });
      },
      setShippingAddress: async (payload) => success(checkouts.get(keyOf(payload, 'checkout')) ?? conformanceCheckout('missing', conformanceCart('missing', []))),
      getAvailableShippingMethods: async () => success([{
        identifier: { key: 'standard' },
        name: 'Standard shipping',
        description: 'Ships soon',
        price: { value: 5, currency: 'EUR' },
        deliveryTime: '3-5 business days',
        carrier: 'Reactionary',
      }]),
      setShippingInstruction: async (payload) => success(checkouts.get(keyOf(payload, 'checkout')) ?? conformanceCheckout('missing', conformanceCart('missing', []))),
      addPaymentInstruction: async (payload) => declinePayments
        ? error<GenericError>({ type: 'Generic', message: 'declined' })
        : success(checkouts.get(keyOf(payload, 'checkout')) ?? conformanceCheckout('missing', conformanceCart('missing', []))),
      finalizeCheckout: async (payload) => {
        const checkout = checkouts.get(keyOf(payload, 'checkout')) ?? conformanceCheckout('missing', conformanceCart('missing', []));
        const finalized = { ...checkout, resultingOrder: { key: 'order-1' } };
        checkouts.set(finalized.identifier.key, finalized);
        return success(finalized);
      },
    },
    product: {
      getBySKU: async () => success({
        identifier: { key: 'product-1' },
        name: 'Test product',
        slug: 'test-product',
        description: 'A test product',
        longDescription: '',
        brand: '',
        manufacturer: '',
        parentCategories: [],
        published: true,
        sharedAttributes: [],
        options: [],
        mainVariant: {
          identifier: { sku: 'sku-1' },
          name: 'Test variant',
          images: [{ sourceUrl: 'https://cdn.example/sku-1.png', altText: 'Test variant' }],
          ean: '',
          gtin: '',
          upc: '',
          barcode: '',
          options: [],
        },
        variants: [],
      }),
    },
    order: {
      getById: async (payload) => success(conformanceOrder(keyOf(payload, 'order'))),
    },
  };
}

function conformanceCart(id: string, items: Array<{ sku: string; quantity: number }>, discounted = false): Cart {
  const factor = discounted ? 0.9 : 1;
  const lines = items.map((item, index) => ({
    identifier: { key: `line-${index + 1}` },
    product: { key: 'product-1' },
    variant: { sku: item.sku },
    quantity: item.quantity,
    price: {
      unitPrice: { value: 10, currency: 'EUR' as const },
      unitDiscount: { value: discounted ? 1 : 0, currency: 'EUR' as const },
      totalPrice: { value: item.quantity * 10 * factor, currency: 'EUR' as const },
      totalDiscount: { value: item.quantity * 10 * (1 - factor), currency: 'EUR' as const },
    },
  }));
  const base = items.reduce((sum, item) => sum + item.quantity * 10, 0);

  return {
    identifier: { key: id },
    user: { userId: '' },
    name: '',
    description: '',
    items: lines,
    price: {
      totalTax: { value: 0, currency: 'EUR' },
      totalDiscount: { value: base * (1 - factor), currency: 'EUR' },
      totalSurcharge: { value: 0, currency: 'EUR' },
      totalShipping: { value: 0, currency: 'EUR' },
      totalProductPrice: { value: base, currency: 'EUR' },
      grandTotal: { value: base * factor, currency: 'EUR' },
    },
    appliedPromotions: discounted ? [{ code: 'SAVE10', isCouponCode: true, name: '10% off', description: '' }] : [],
  };
}

function conformanceCheckout(id: string, cart: Cart): Checkout {
  return {
    identifier: { key: id },
    originalCartReference: cart.identifier,
    items: cart.items.map((item) => ({ identifier: item.identifier, variant: item.variant, quantity: item.quantity, price: item.price })),
    price: cart.price,
    name: '',
    description: '',
    pointOfContact: { email: 'ada@example.com' },
    billingAddress: null,
    paymentInstructions: [],
    readyForFinalization: true,
  };
}

function conformanceOrder(id: string): Order {
  const cart = conformanceCart('cart-order', [{ sku: 'sku-1', quantity: 1 }]);

  return {
    identifier: { key: id },
    userId: { userId: '' },
    items: cart.items.map((item) => ({ identifier: item.identifier, variant: item.variant, quantity: item.quantity, price: item.price, inventoryStatus: 'Allocated' })),
    price: cart.price,
    shippingMethod: {
      identifier: { key: 'standard' },
      name: 'Standard shipping',
      description: '',
      price: { value: 5, currency: 'EUR' },
      deliveryTime: '',
      carrier: 'Reactionary',
    },
    orderStatus: 'ReleasedToFulfillment',
    inventoryStatus: 'Allocated',
    paymentInstructions: [],
  };
}
