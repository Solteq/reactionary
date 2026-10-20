import {
  MemoryCache,
  error,
  success,
  type Cart,
  type Checkout,
  type CostBreakDown,
  type GenericError,
  type Inventory,
  type ShippingMethod,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import type { UCPInventoryOptions, UCPTestPaymentHandler } from './reactionary-ucp-checkout-session.js';
import type { ReactionaryUCPClient, UCPPaymentHandlers } from './reactionary-ucp-common.js';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';
import type { ReactionaryUCPWebhookOptions } from './reactionary-ucp-webhooks.js';

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
  /** Inventory records keyed by `sku@fulfillmentCenter`. */
  public readonly stock = new Map<string, Inventory>();
  /** Coupon codes applied per cart; only SAVE2 (2 EUR off each line) exists, matched exactly. */
  public readonly couponCodes = new Map<string, string[]>();
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
        applyCouponCode: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          if (!cart || payload.couponCode !== 'SAVE2') {
            return error<GenericError>({ type: 'Generic', message: 'invalid code' });
          }
          this.couponCodes.set(cart.identifier.key, [payload.couponCode]);
          return success(this.saveCart(cart.identifier.key, cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity }))));
        },
        removeCouponCode: async (payload) => {
          const cart = this.carts.get(payload.cart.key);
          if (!cart) {
            return notFound();
          }
          this.couponCodes.set(cart.identifier.key, (this.couponCodes.get(cart.identifier.key) ?? []).filter((code) => code !== payload.couponCode));
          return success(this.saveCart(cart.identifier.key, cart.items.map((item) => ({ sku: item.variant.sku, quantity: item.quantity }))));
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
      order: {
        getById: async (payload) => {
          const checkout = [...this.checkouts.values()].find((candidate) => candidate.resultingOrder?.key === payload.order.key);
          return checkout ? success({
            identifier: { key: payload.order.key },
            userId: { userId: '' },
            items: checkout.items.map((item) => ({ ...item, inventoryStatus: 'NotAllocated' as const })),
            price: checkout.price,
            orderStatus: 'AwaitingPayment',
            inventoryStatus: 'NotAllocated',
            paymentInstructions: [],
          }) : notFound();
        },
      },
      inventory: {
        getBySKU: async (payload) => {
          const inventory = this.stock.get(`${payload.variant.sku}@${payload.fulfilmentCenter.key}`);
          return inventory ? success(inventory) : notFound();
        },
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
    const cart = createCart(key, items, this.couponCodes.get(key) ?? []);
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

function createCart(key: string, items: Array<{ sku: string; quantity: number }>, couponCodes: string[] = []): Cart {
  const lineDiscount = couponCodes.includes('SAVE2') ? 2 : 0;
  const discount = lineDiscount * items.length;
  const price = createCost(items.reduce((sum, item) => sum + 10 * item.quantity, 0) - discount);

  return {
    identifier: { key },
    user: { userId: '' },
    name: '',
    description: '',
    appliedPromotions: couponCodes.map((code) => ({ code, isCouponCode: true, name: 'Save 2', description: '' })),
    items: items.map((item, index) => ({
      identifier: { key: `line-${index + 1}` },
      product: { key: item.sku },
      variant: { sku: item.sku },
      quantity: item.quantity,
      price: {
        unitPrice: { value: 10, currency: 'EUR' },
        unitDiscount: { value: lineDiscount / item.quantity, currency: 'EUR' },
        totalPrice: { value: 10 * item.quantity - lineDiscount, currency: 'EUR' },
        totalDiscount: { value: lineDiscount, currency: 'EUR' },
      },
    })),
    price: { ...price, totalDiscount: { value: discount, currency: 'EUR' } },
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
  options: {
    registeredEmail?: string;
    authorizationTimeoutMs?: number;
    paymentHandlers?: UCPPaymentHandlers;
    testPaymentHandlers?: UCPTestPaymentHandler[];
    inventory?: UCPInventoryOptions;
    testOrderUpdates?: boolean;
    webhooks?: ReactionaryUCPWebhookOptions;
    testSimulationSecret?: string;
    acceptRawCardCredentials?: boolean;
  } = {},
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
      ...(options.testPaymentHandlers ? { testPaymentHandlers: options.testPaymentHandlers } : {}),
      ...(options.inventory ? { inventory: options.inventory } : {}),
      ...(options.testOrderUpdates ? { testOrderUpdates: true } : {}),
      ...(options.webhooks ? { webhooks: options.webhooks } : {}),
      ...(options.testSimulationSecret ? { testSimulationSecret: options.testSimulationSecret } : {}),
      ...(options.acceptRawCardCredentials ? { acceptRawCardCredentials: true } : {}),
      profile: {
        endpoint: BASE,
        merchant: { name: 'Shop', url: 'https://shop.example.com', contact: { email: 'a@example.com' } },
        keys: [],
        ...(options.paymentHandlers ? { paymentHandlers: options.paymentHandlers } : {}),
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
const stripeHandlers: UCPPaymentHandlers = { 'com.stripe': [{ version: '2026-08-25', id: 'stripe' }] };
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

  it('rejects instruments of handlers that are not advertised without placing a checkout', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend, { paymentHandlers: stripeHandlers });
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
    });

    const refused = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {
      payment: { instruments: [{ id: 'instr-1', handler_id: 'unknown_handler', type: 'card', credential: { type: 'token', token: 'tok' } }] },
    });

    expect(refused.status).toBe('incomplete');
    expect(messageCodes(refused)).toEqual(['payment_failed:$.payment.instruments']);
    expect(backend.checkouts.size).toBe(0);
  });

  it('places test handler payments through the delegate with the resolved credential', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend, {
      paymentHandlers: stripeHandlers,
      testPaymentHandlers: [{
        id: 'mock_payment_handler',
        delegateHandlerId: 'stripe',
        resolveCredential: (credential) =>
          JSON.stringify(credential).includes('success_token') ? { type: 'token', token: 'pm_card_visa' } : undefined,
      }],
    });
    const mockInstrument = (token: string) => ({
      payment: { instruments: [{ id: 'instr-1', handler_id: 'mock_payment_handler', type: 'card', credential: { type: 'token', token } }] },
    });
    const declinedSession = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
    });
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
    });

    const declined = await send(server, 'POST', `/checkout-sessions/${declinedSession.id}/complete`, mockInstrument('fail_token'));
    expect(declined.status).toBe('incomplete');
    expect(messageCodes(declined)).toEqual(['payment_failed:$.payment.instruments']);
    expect(backend.checkouts.size).toBe(0);

    await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, mockInstrument('success_token'));

    const [finalCheckout] = [...backend.checkouts.values()];
    expect(finalCheckout.paymentInstructions[0].paymentMethod.paymentProcessor).toBe('stripe');
    expect(finalCheckout.paymentInstructions[0].protocolData).toEqual(expect.arrayContaining([
      { key: 'ucp_payment_handler_id', value: 'stripe' },
      { key: 'ucp_payment_credential', value: JSON.stringify({ type: 'token', token: 'pm_card_visa' }) },
    ]));
  });

  it('refuses raw card credentials without placing a checkout, unless explicitly accepted', async () => {
    const pan = { type: 'pan', number: '4242424242424242', expiry_month: 12, expiry_year: 2030, cvc: '123' };
    const complete = async (server: ReactionaryUCPServer) => {
      const created = await send(server, 'POST', '/checkout-sessions', {
        line_items: lineItems,
        buyer: { email: 'ada@example.com' },
        fulfillment: fulfillment('standard'),
      });
      return send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {
        payment: { instruments: [{ ...selectedInstrument.instruments[0], credential: pan }] },
      });
    };

    const refusingBackend = new FakeBackend();
    const refused = await complete(createServer(refusingBackend));
    expect(refused.status).toBe('incomplete');
    expect(messageCodes(refused)).toEqual(['payment_failed:$.payment.instruments']);
    expect(refusingBackend.checkouts.size).toBe(0);

    const acceptingBackend = new FakeBackend();
    await complete(createServer(acceptingBackend, { acceptRawCardCredentials: true }));
    const [finalCheckout] = [...acceptingBackend.checkouts.values()];
    expect(finalCheckout.paymentInstructions[0].protocolData).toContainEqual({
      key: 'ucp_payment_credential',
      value: JSON.stringify(pan),
    });
  });

  it('refuses test handlers that delegate to a handler that is not advertised', () => {
    expect(() => createServer(new FakeBackend(), {
      paymentHandlers: stripeHandlers,
      testPaymentHandlers: [{ id: 'mock_payment_handler', delegateHandlerId: 'adyen', resolveCredential: () => undefined }],
    })).toThrow(/not an advertised payment handler/);
  });

  it('does not accept a billing address in place of a shipping destination', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
    });

    const refused = await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {
      payment: { instruments: [{ ...selectedInstrument.instruments[0], billing_address: destination }] },
    });

    expect(refused.status).toBe('incomplete');
    expect(messageCodes(refused)).toContain('missing:$.fulfillment.methods[0].destinations');
    expect(backend.checkouts.size).toBe(0);
  });

  it('reports line items exceeding the combined stock of the fulfillment centers as out_of_stock', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend, { inventory: { fulfillmentCenterKeys: ['online', 'store'] } });
    const setStock = (sku: string, center: string, quantity: number, status: Inventory['status']) =>
      backend.stock.set(`${sku}@${center}`, {
        identifier: { variant: { sku }, fulfillmentCenter: { key: center } },
        quantity,
        status,
      });
    setStock('sku-1', 'online', 1, 'inStock');
    setStock('sku-1', 'store', 1, 'inStock');
    setStock('sku-sold-out', 'online', -3, 'outOfStock');
    setStock('sku-preorder', 'online', 0, 'preOrder');
    const ready = {
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('standard'),
      payment: selectedInstrument,
    };
    const withItem = (sku: string, quantity: number) => ({
      ...ready,
      line_items: [{ ...lineItems[0], item: { ...lineItems[0].item, id: sku }, quantity }],
    });

    const inStock = await send(server, 'POST', '/checkout-sessions', withItem('sku-1', 2));
    expect(inStock.status).toBe('ready_for_complete');

    const exceeding = await send(server, 'PUT', `/checkout-sessions/${inStock.id}`, {
      line_items: [{ ...lineItems[0], quantity: 3 }],
    });
    expect(exceeding.status).toBe('incomplete');
    expect(exceeding.messages).toContainEqual(expect.objectContaining({
      code: 'out_of_stock',
      path: '$.line_items[0]',
      content: 'Only 2 of sku-1 are in stock.',
    }));

    const soldOut = await send(server, 'POST', '/checkout-sessions', withItem('sku-sold-out', 1));
    expect(messageCodes(soldOut)).toEqual(['out_of_stock:$.line_items[0]']);
    const refused = await send(server, 'POST', `/checkout-sessions/${soldOut.id}/complete`, {});
    expect(refused.status).toBe('incomplete');

    const preOrder = await send(server, 'POST', '/checkout-sessions', withItem('sku-preorder', 5));
    const untracked = await send(server, 'POST', '/checkout-sessions', withItem('sku-untracked', 5));
    expect(preOrder.status).toBe('ready_for_complete');
    expect(untracked.status).toBe('ready_for_complete');
    expect(backend.checkouts.size).toBe(0);
  });

  it('applies discount codes with replacement semantics and reports rejected codes', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    interface DiscountedBody extends UcpCheckoutBody {
      discounts?: { codes: string[]; applied: Array<{ code?: string; title: string; amount: number; allocations?: Array<{ path: string; amount: number }> }> };
      line_items: Array<{ item: { id: string }; quantity: number; totals?: Array<{ type: string; amount: number }> }>;
    }
    const created = (await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      discounts: { codes: ['save2', 'NOPE'] },
    })) as DiscountedBody;

    expect(created.discounts).toEqual({
      codes: ['SAVE2'],
      applied: [{ code: 'SAVE2', title: 'Save 2', amount: 200, automatic: false, allocations: [{ path: '$.line_items[0]', amount: 200 }] }],
    });
    expect(created.totals).toEqual(expect.arrayContaining([
      { type: 'subtotal', amount: 1000 },
      { type: 'items_discount', amount: -200 },
      { type: 'total', amount: 800 },
    ]));
    expect(created.line_items[0].totals).toContainEqual({ type: 'items_discount', amount: -200 });
    expect(created.messages).toContainEqual(expect.objectContaining({
      type: 'warning',
      code: 'discount_code_invalid',
      path: '$.discounts.codes[1]',
    }));

    const unchanged = (await send(server, 'PUT', `/checkout-sessions/${created.id}`, { buyer: { email: 'ada@example.com' } })) as DiscountedBody;
    expect(unchanged.discounts?.codes).toEqual(['SAVE2']);

    const cleared = (await send(server, 'PUT', `/checkout-sessions/${created.id}`, { discounts: { codes: [] } })) as DiscountedBody;
    expect(cleared.discounts).toEqual({ codes: [], applied: [] });
    expect(cleared.totals.find((total) => total.type === 'items_discount')).toBeUndefined();
  });

  it('round-trips buyer consent on the session', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const consent = {
      'dev.ucp.consent.marketing': {
        granted: false,
        source: 'platform',
        segments: { 'dev.ucp.consent.marketing.sms': { granted: true, source: 'platform' } },
      },
      analytics: false,
    };

    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com', consent },
    });
    const fetched = (await send(server, 'GET', `/checkout-sessions/${created.id}`)) as UcpCheckoutBody & { buyer?: { consent?: unknown } };

    expect(fetched.buyer?.consent).toEqual(consent);
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

interface UcpOrderBody {
  id?: string;
  checkout_id?: string;
  line_items?: Array<{ id: string; quantity: { total: number; fulfilled: number }; status: string }>;
  fulfillment?: {
    expectations: Array<{ description?: string; method_type: string; destination: { address_country?: string } }>;
    events: Array<{ tracking_number?: string }>;
  };
  adjustments?: Array<{ type: string }>;
  messages?: Array<{ code: string }>;
}

describe('UCP orders', () => {
  const OTHER_AGENT = 'profile="https://other-agent.example.com/profile"';

  async function placeOrder(server: ReactionaryUCPServer, backend: FakeBackend) {
    const created = await send(server, 'POST', '/checkout-sessions', {
      line_items: lineItems,
      buyer: { email: 'ada@example.com' },
      fulfillment: fulfillment('express'),
      payment: selectedInstrument,
    });
    // Completion places the checkout; once its payment is authorized, a
    // repeated complete finalizes it.
    await send(server, 'POST', `/checkout-sessions/${created.id}/complete`, {});
    for (const checkout of backend.checkouts.values()) {
      backend.authorized.add(checkout.identifier.key);
    }
    const completeResponse = await server.fetch(new Request(`${BASE}/checkout-sessions/${created.id}/complete`, {
      method: 'POST',
      headers: { 'UCP-Agent': AGENT, 'content-type': 'application/json' },
      body: '{}',
    }));
    const completed = (await completeResponse.json()) as UcpCheckoutBody;

    return {
      checkoutId: created.id,
      orderId: completed.order?.id ?? '',
      sessionId: completeResponse.headers.get('ucp-session-id'),
    };
  }

  async function sendOrder(
    server: ReactionaryUCPServer,
    method: 'GET' | 'PUT',
    orderId: string,
    options: { agent?: string; body?: unknown } = {},
  ): Promise<{ status: number; sessionId: string | null; body: UcpOrderBody }> {
    const response = await server.fetch(new Request(`${BASE}/orders/${orderId}`, {
      method,
      headers: { 'UCP-Agent': options.agent ?? AGENT, 'content-type': 'application/json' },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    }));

    return {
      status: response.status,
      sessionId: response.headers.get('ucp-session-id'),
      body: (await response.json()) as UcpOrderBody,
    };
  }

  it('reports the order with its checkout, line items and selected fulfillment', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const placed = await placeOrder(server, backend);

    const order = await sendOrder(server, 'GET', placed.orderId);

    expect(order.body).toMatchObject({
      id: placed.orderId,
      checkout_id: placed.checkoutId,
      line_items: [{ quantity: { total: 1, fulfilled: 0 }, status: 'processing' }],
      fulfillment: {
        expectations: [{ description: 'Express', method_type: 'shipping', destination: { address_country: 'DK' } }],
        events: [],
      },
      adjustments: [],
    });
  });

  it('resumes the placing session only for the platform that completed the checkout', async () => {
    const backend = new FakeBackend();
    const server = createServer(backend);
    const placed = await placeOrder(server, backend);

    const own = await sendOrder(server, 'GET', placed.orderId);
    const other = await sendOrder(server, 'GET', placed.orderId, { agent: OTHER_AGENT });

    expect(own.sessionId).toBe(placed.sessionId);
    expect(other.sessionId).not.toBe(placed.sessionId);
  });

  it('accepts fulfillment events and adjustments only with testOrderUpdates', async () => {
    const backend = new FakeBackend();
    const placedWithout = await placeOrder(createServer(backend), backend);
    expect((await sendOrder(createServer(backend), 'PUT', placedWithout.orderId, { body: {} })).status).toBe(404);

    const server = createServer(backend, { testOrderUpdates: true });
    const placed = await placeOrder(server, backend);
    const [lineItem] = (await sendOrder(server, 'GET', placed.orderId)).body.line_items ?? [];
    const occurredAt = new Date().toISOString();

    const invalid = await sendOrder(server, 'PUT', placed.orderId, {
      body: { adjustments: [{ id: 'adj-1', type: 'refund', occurred_at: occurredAt, status: 'INVALID' }] },
    });
    expect(invalid.status).toBe(422);

    const updated = await sendOrder(server, 'PUT', placed.orderId, {
      body: {
        fulfillment: {
          events: [{
            id: 'evt-1',
            occurred_at: occurredAt,
            type: 'shipped',
            line_items: [{ id: lineItem.id, quantity: 1 }],
            tracking_number: 'TRACK123',
            tracking_url: 'https://track.example.com/123',
          }],
        },
        adjustments: [{ id: 'adj-1', type: 'refund', occurred_at: occurredAt, status: 'pending', totals: [{ type: 'total', amount: -500 }] }],
      },
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      line_items: [{ quantity: { total: 1, fulfilled: 1 }, status: 'fulfilled' }],
      fulfillment: { events: [{ tracking_number: 'TRACK123' }] },
      adjustments: [{ type: 'refund' }],
    });
  });

  it('sends the order created webhook, and an update when shipping is simulated', async () => {
    const backend = new FakeBackend();
    const deliveries: Array<{ url: string; body: UcpOrderBody }> = [];
    const agentFetch: typeof fetch = async (input, init) => {
      if (String(input) === 'https://agent.example.com/profile') {
        return Response.json({
          ucp: { capabilities: { 'dev.ucp.shopping.order': [{ config: { webhook_url: 'https://agent.example.com/hooks' } }] } },
        });
      }
      deliveries.push({ url: String(input), body: JSON.parse(String(init?.body)) as UcpOrderBody });
      return new Response(null, { status: 200 });
    };
    const server = createServer(backend, { webhooks: { fetch: agentFetch }, testSimulationSecret: 'sim-secret' });
    const waitForDeliveries = async (count: number) => {
      for (let attempt = 0; attempt < 100 && deliveries.length < count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };
    const simulate = (orderId: string, secret?: string) => server.fetch(new Request(`https://shop.example.com/testing/simulate-shipping/${orderId}`, {
      method: 'POST',
      headers: { 'UCP-Agent': AGENT, ...(secret ? { 'Simulation-Secret': secret } : {}) },
    }));

    const placed = await placeOrder(server, backend);
    await waitForDeliveries(1);
    expect(deliveries[0]).toMatchObject({
      url: 'https://agent.example.com/hooks',
      body: { id: placed.orderId, checkout_id: placed.checkoutId, fulfillment: { events: [] } },
    });

    expect((await simulate(placed.orderId)).status).toBe(403);
    expect((await simulate(placed.orderId, 'wrong')).status).toBe(403);
    expect((await simulate(placed.orderId, 'sim-secret')).status).toBe(200);
    await waitForDeliveries(2);

    expect(deliveries).toHaveLength(2);
    expect(deliveries[1].body).toMatchObject({
      id: placed.orderId,
      line_items: [{ status: 'fulfilled' }],
      fulfillment: { events: [{ type: 'shipped' }] },
    });
  });
});
