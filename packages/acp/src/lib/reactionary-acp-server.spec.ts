import {
  MemoryCache,
  success,
  type Cart,
  type Checkout,
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
});

function createTestClient(): ReactionaryACPClient {
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
