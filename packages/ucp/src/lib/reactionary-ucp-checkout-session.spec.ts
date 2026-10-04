import {
  MemoryCache,
  error,
  success,
  type Cart,
  type Checkout,
  type CostBreakDown,
  type GenericError,
  type ShippingMethod,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import type { ReactionaryUCPClient } from './reactionary-ucp-common.js';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

const BASE = 'https://shop.example.com/ucp';
const AGENT = 'profile="https://agent.example.com/profile"';

/**
 * In-memory backend modelled on commercetools: a checkout is a copy of the
 * cart with its own key, initiation requires an email, and payments only
 * become authorized out-of-band.
 */
class FakeBackend {
  public readonly carts = new Map<string, Cart>();
  public readonly checkouts = new Map<string, Checkout>();
  public readonly deletedCheckouts: string[] = [];
  public readonly initiatedEmails: string[] = [];
  public readonly authorized = new Set<string>();
  private counter = 0;

  public readonly shippingMethods: ShippingMethod[] = [
    {
      identifier: { key: 'standard' },
      name: 'Standard',
      description: '',
      price: { value: 5, currency: 'EUR' },
      deliveryTime: '',
    },
    {
      identifier: { key: 'express' },
      name: 'Express',
      description: '',
      price: { value: 15, currency: 'EUR' },
      deliveryTime: '',
    },
  ];

  public createClient(profileEmail?: string): ReactionaryUCPClient {
    return {
      cart: {
        createCart: async () => success(this.saveCart(`cart-${++this.counter}`, [])),
        getById: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          return cart ? success(cart) : notFound();
        },
        add: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          if (!cart || payload.variant.sku === 'unknown-sku') {
            return notFound();
          }
          return success(this.saveCart(cart.identifier.key, [
            ...cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity })),
            { sku: payload.variant.sku, quantity: payload.quantity },
          ]));
        },
        changeQuantity: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          if (!cart) {
            return notFound();
          }
          return success(this.saveCart(cart.identifier.key, cart.items.map((item) => ({
            sku: item.variant.sku,
            quantity: item.identifier.key === payload.item.key ? payload.quantity : item.quantity,
          }))));
        },
        remove: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          if (!cart) {
            return notFound();
          }
          return success(this.saveCart(cart.identifier.key, cart.items
            .filter((item) => item.identifier.key !== payload.item.key)
            .map((item) => ({ sku: item.variant.sku, quantity: item.quantity }))));
        },
        deleteCart: async (payload) => {
          this.checkouts.delete(payload.cart.key);
          this.deletedCheckouts.push(payload.cart.key);
          return success(undefined);
        },
      },
      checkout: {
        initiateCheckoutForCart: async (payload) => {
          if (!payload.notificationEmail) {
            return error<GenericError>({ type: 'Generic', message: 'email required' });
          }
          this.initiatedEmails.push(payload.notificationEmail);
          const key = `checkout-${++this.counter}`;
          return success(this.saveCheckout({
            ...createCheckout(key, payload.cart),
            pointOfContact: { email: payload.notificationEmail },
            billingAddress: payload.billingAddress ? { ...payload.billingAddress, identifier: { nickName: '' } } : null,
          }));
        },
        getById: async (payload) => {
          const checkout = this.checkouts.get(payload.identifier.key);
          return checkout ? success(this.withReadiness(checkout)) : notFound();
        },
        setShippingAddress: async (payload) => this.updateCheckout(payload.checkout.key, (checkout) => ({
          ...checkout,
          shippingAddress: { ...payload.shippingAddress, identifier: { nickName: '' } },
        })),
        getAvailableShippingMethods: async () => success(this.shippingMethods),
        setShippingInstruction: async (payload) => this.updateCheckout(payload.checkout.key, (checkout) => {
          const method = this.shippingMethods.find((candidate) => candidate.identifier.key === payload.shippingInstruction.shippingMethod.key);
          const shipping = method?.price.value ?? 0;
          return {
            ...checkout,
            shippingInstruction: payload.shippingInstruction,
            price: createCost(checkout.price.totalProductPrice.value, shipping),
          };
        }),
        addPaymentInstruction: async (payload) => this.updateCheckout(payload.checkout.key, (checkout) => ({
          ...checkout,
          paymentInstructions: [{
            identifier: { key: `payment-${checkout.identifier.key}` },
            amount: payload.paymentInstruction.amount,
            paymentMethod: payload.paymentInstruction.paymentMethod,
            protocolData: payload.paymentInstruction.protocolData,
            status: 'pending',
          }],
        })),
        finalizeCheckout: async (payload) => this.updateCheckout(payload.checkout.key, (checkout) => ({
          ...checkout,
          resultingOrder: { key: `order-${checkout.identifier.key}` },
        })),
      },
      profile: {
        getById: async () => profileEmail
          ? success({
            identifier: { userId: 'user-1' },
            email: profileEmail,
            phone: '',
            emailVerified: true,
            phoneVerified: false,
            createdAt: '',
            updatedAt: '',
            alternateShippingAddresses: [],
          })
          : notFound(),
      },
    };
  }

  private withReadiness(checkout: Checkout): Checkout {
    return {
      ...checkout,
      readyForFinalization: Boolean(
        checkout.shippingInstruction &&
        checkout.paymentInstructions.length > 0 &&
        this.authorized.has(checkout.identifier.key),
      ),
    };
  }

  private saveCart(key: string, items: Array<{ sku: string; quantity: number }>): Cart {
    const cart = createCart(key, items);
    this.carts.set(key, cart);
    return cart;
  }

  private saveCheckout(checkout: Checkout): Checkout {
    this.checkouts.set(checkout.identifier.key, checkout);
    return this.withReadiness(checkout);
  }

  private async updateCheckout(key: string, update: (checkout: Checkout) => Checkout) {
    const checkout = this.checkouts.get(key);
    return checkout ? success(this.saveCheckout(update(checkout))) : notFound();
  }
}

function notFound() {
  return error<GenericError>({ type: 'Generic', message: 'not found' });
}

function createCost(products: number, shipping = 0): CostBreakDown {
  const amount = (value: number) => ({ value, currency: 'EUR' as const });
  return {
    totalTax: amount(0),
    totalDiscount: amount(0),
    totalSurcharge: amount(0),
    totalShipping: amount(shipping),
    totalProductPrice: amount(products),
    grandTotal: amount(products + shipping),
  };
}

function createCart(key: string, items: Array<{ sku: string; quantity: number }>): Cart {
  return {
    identifier: { key },
    user: { userId: '' },
    name: '',
    description: '',
    appliedPromotions: [],
    items: items.map((item, index) => ({
      identifier: { key: `line-${index + 1}` },
      product: { key: item.sku },
      variant: { sku: item.sku },
      quantity: item.quantity,
      price: {
        unitPrice: { value: 10, currency: 'EUR' },
        unitDiscount: { value: 0, currency: 'EUR' },
        totalPrice: { value: 10 * item.quantity, currency: 'EUR' },
        totalDiscount: { value: 0, currency: 'EUR' },
      },
    })),
    price: createCost(items.reduce((sum, item) => sum + 10 * item.quantity, 0)),
  };
}

function createCheckout(key: string, cart: Cart): Checkout {
  return {
    identifier: { key },
    originalCartReference: cart.identifier,
    name: '',
    description: '',
    items: cart.items.map((item) => ({
      identifier: item.identifier,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
    })),
    price: cart.price,
    pointOfContact: { email: '' },
    paymentInstructions: [],
    readyForFinalization: false,
  };
}

interface UcpCheckoutBody {
  id: string;
  status: string;
  totals: Array<{ type: string; amount: number }>;
  line_items: Array<{ item: { id: string }; quantity: number }>;
  messages?: Array<{ type: string; code: string; path?: string }>;
  order?: { id: string };
  fulfillment?: {
    methods: Array<{
      groups: Array<{ options: Array<{ id: string; title: string }>; selected_option_id?: string }>;
    }>;
  };
}

function createServer(
  backend: FakeBackend,
  options: { registeredEmail?: string; authorizationTimeoutMs?: number } = {},
) {
  return new ReactionaryUCPServer(
    (requestContext) => {
      if (options.registeredEmail) {
        requestContext.session.identityContext.identity = {
          type: 'Registered',
          id: { userId: 'user-1' },
        };
      }
      return backend.createClient(options.registeredEmail);
    },
    {
      sessionCache: new MemoryCache(),
      paymentAuthorizationWait: { timeoutMs: options.authorizationTimeoutMs ?? 0, intervalMs: 10 },
      profile: {
        endpoint: BASE,
        merchant: { name: 'Shop', url: 'https://shop.example.com', contact: { email: 'a@example.com' } },
        keys: [],
      },
    },
  );
}

async function send(
  server: ReactionaryUCPServer,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<UcpCheckoutBody> {
  // Agents do not carry the UCP session header between calls.
  const response = await server.fetch(new Request(`${BASE}${path}`, {
    method,
    headers: { 'UCP-Agent': AGENT, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));

  return (await response.json()) as UcpCheckoutBody;
}

const lineItems = [{ id: 'li-1', item: { id: 'sku-1', title: 'sku-1', price: 1000 }, quantity: 1, totals: [] }];
const destination = {
  id: 'dest_1',
  street_address: '1 Main St',
  address_locality: 'Copenhagen',
  postal_code: '1000',
  address_country: 'DK',
};
const fulfillment = (selectedOptionId?: string) => ({
  methods: [{
    type: 'shipping',
    destinations: [destination],
    selected_destination_id: 'dest_1',
    groups: [{ ...(selectedOptionId ? { selected_option_id: selectedOptionId } : {}) }],
  }],
});
const selectedInstrument = { instruments: [{ id: 'instr-1', handler_id: 'stripe', type: 'card', selected: true }] };

function messageCodes(body: UcpCheckoutBody): string[] {
  return (body.messages ?? []).map((message) => `${message.code}:${message.path ?? ''}`);
}

describe('UCP checkout sessions', () => {
  it('creates a session without buyer data and reports what is missing', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);

    const created = await send(server, 'POST', '/checkout-sessions', { line_items: lineItems });

    expect(created.id).toMatch(/^checkout_/);
    expect(created.status).toBe('incomplete');
    expect(created.line_items[0]).toMatchObject({ item: { id: 'sku-1' }, quantity: 1 });
    expect(created.totals.find((total) => total.type === 'total')?.amount).toBe(1000);
    expect(messageCodes(created)).toEqual(expect.arrayContaining([
      'missing:$.buyer.email',
      'missing:$.fulfillment.methods[0].destinations',
      'missing:$.payment.instruments',
    ]));
    // Without an address, nothing is priced, so no backend checkout exists.
    expect(backend.checkouts.size).toBe(0);
  });

  it('quotes fulfillment options from a destination alone, using the placeholder email', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);

    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      fulfillment: fulfillment(),
    });

    const options = created.fulfillment?.methods[0].groups[0].options ?? [];
    expect(options.map((option) => option.id)).toEqual(['standard', 'express']);
    expect(new Set(options.map((option) => option.title)).size).toBe(2);
    expect(backend.initiatedEmails).toEqual(['pending@checkout.invalid']);
    // The transient checkout was a cart copy, so it was discarded again.
    expect(backend.checkouts.size).toBe(0);
    expect(backend.deletedCheckouts).toHaveLength(1);
    expect(messageCodes(created)).toContain('missing:$.fulfillment.methods[0].groups[0].selected_option_id');
  });

  it('progresses to ready_for_complete as buyer data arrives, and resumes the owning session by id', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', { line_items: lineItems });

    await send(server, 'PUT', `/checkout-sessions/${created.id}`, {
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('express'),
    });
    const ready = await send(server, 'PUT', `/checkout-sessions/${created.id}`, {
      payment: selectedInstrument,
    });

    expect(ready.status).toBe('ready_for_complete');
    expect(ready.messages).toBeUndefined();
    expect(ready.fulfillment?.methods[0].groups[0].selected_option_id).toBe('express');
    // 1000 (sku) + 1500 (express shipping), in minor units.
    expect(ready.totals.find((total) => total.type === 'total')?.amount).toBe(2500);
    expect(backend.initiatedEmails.at(-1)).toBe('ada@example.com');
  });

  it('replaces line items on update without changing the session id', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', { line_items: lineItems });

    const updated = await send(server, 'PUT', `/checkout-sessions/${created.id}`, {
      line_items: [{ ...lineItems[0], quantity: 3 }],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.line_items[0].quantity).toBe(3);
  });

  it('completes in progress until payment is authorized, then places the order exactly once', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    });

    const pending = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});

    expect(pending.status).toBe('complete_in_progress');
    expect(pending.order).toBeUndefined();
    const finalCheckouts = [...backend.checkouts.values()];
    expect(finalCheckouts).toHaveLength(1);
    expect(finalCheckouts[0].pointOfContact.email).toBe('ada@example.com');

    backend.authorized.add(finalCheckouts[0].identifier.key);

    const completed = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});
    const repeated = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});
    const fetched = await send(server, 'GET', `/checkout-sessions/${created.id}`);

    expect(completed.status).toBe('completed');
    expect(completed.id).toBe(created.id);
    expect(completed.order?.id).toBe(`order-${finalCheckouts[0].identifier.key}`);
    // Completing an already completed session is refused; reads still show the order.
    expect(messageCodes(repeated)).toEqual(['checkout_not_modifiable:']);
    expect(fetched.status).toBe('completed');
    expect(fetched.order?.id).toBe(completed.order?.id);
    expect(backend.checkouts.size).toBe(1);
  });

  it('waits for an asynchronous payment authorization before answering', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend, { authorizationTimeoutMs: 2_000 });
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    });

    // The PSP webhook records the authorization shortly after the payment is added.
    const authorize = setInterval(() => {
      for (const checkout of backend.checkouts.values()) {
        if (checkout.paymentInstructions.length > 0) {
          backend.authorized.add(checkout.identifier.key);
        }
      }
    }, 20);

    try {
      const completed = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});

      expect(completed.status).toBe('completed');
      expect(completed.order?.id).toBeTruthy();
    } finally {
      clearInterval(authorize);
    }
  });

  it('forwards the payment credential from complete without storing it', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    });
    const credential = { type: 'stripe_payment_method', token: 'pm_card_visa' };

    await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {
      payment: { instruments: [{ ...selectedInstrument.instruments[0], credential }] },
    });
    const fetched = await send(server, 'GET', `/checkout-sessions/${created.id}`);

    const [finalCheckout] = [...backend.checkouts.values()];
    expect(finalCheckout.paymentInstructions[0].protocolData).toContainEqual({
      key: 'ucp_payment_credential',
      value: JSON.stringify(credential),
    });
    expect(JSON.stringify(fetched)).not.toContain('pm_card_visa');
  });

  it('refuses to complete without a buyer email', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    });

    const refused = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});

    expect(refused.status).toBe('incomplete');
    expect(messageCodes(refused)).toContain('missing:$.buyer.email');
    expect(backend.checkouts.size).toBe(0);
  });

  it('uses the logged-in profile email instead of the placeholder', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend, { registeredEmail: 'member@example.com' });

    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    });

    expect(backend.initiatedEmails).toEqual(['member@example.com']);
    expect(created.status).toBe('ready_for_complete');
  });

  it('reports unknown items as item_unavailable and cancels sessions', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);

    const unavailable = await send(server, 'POST', '/checkout-sessions', {
      line_items: [{ ...lineItems[0], item: { ...lineItems[0].item, id: 'unknown-sku' } }],
    });
    expect(messageCodes(unavailable)).toEqual(['item_unavailable:$.line_items[0]']);

    const created = await send(server, 'POST', '/checkout-sessions', { line_items: lineItems });
    const canceled = await send(server, 'POST', `/checkout-sessions/${created.id}/cancel`, {});
    const completeAfterCancel = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});

    expect(canceled.status).toBe('canceled');
    expect(messageCodes(completeAfterCancel)).toEqual(['checkout_not_modifiable:']);
  });
});
