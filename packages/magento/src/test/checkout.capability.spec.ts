import {
  CheckoutSchema,
  NoOpCache,
  PaymentMethodSchema,
  ShippingMethodSchema,
  createInitialRequestContext,
  type Address,
  type Cart,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MagentoCheckoutCapability } from '../capabilities/checkout.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { wasMagentoOrderPlacedInSession } from '../core/order.api.js';
import { MagentoCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoCart,
  MagentoCartTotals,
  MagentoCheckoutAddress,
  MagentoCheckoutState,
  MagentoShippingMethod,
} from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const CART_KEY = 'masked-cart-1';
const EMAIL = 'shopper@example.com';

const zero = { value: 0, currency: 'EUR' as const };
const CART_INPUT: Cart = {
  identifier: { key: CART_KEY },
  user: { userId: 'guest' },
  name: '',
  description: '',
  items: [],
  appliedPromotions: [],
  price: {
    totalTax: zero,
    totalDiscount: zero,
    totalSurcharge: zero,
    totalShipping: zero,
    totalProductPrice: zero,
    grandTotal: zero,
  },
};

const SHIPPING_ADDRESS: Omit<Address, 'identifier'> = {
  firstName: 'Jane',
  lastName: 'Doe',
  streetAddress: 'Main St',
  streetNumber: '1',
  city: 'Tallinn',
  region: '',
  postalCode: '10111',
  countryCode: 'EE',
};

const FLATRATE: MagentoShippingMethod = {
  carrier_code: 'flatrate',
  method_code: 'flatrate',
  amount: 5,
  available: true,
};

/**
 * Simulates one Magento backend (the quote is shared, durable state) serving
 * several independent storefront requests: every `request()` gets its own
 * RequestContext and its own session-scoped checkout state, exactly like two
 * separate server actions would.
 */
function createBackend(
  billingAddressStub: Record<string, unknown> | undefined,
  backendConfig: MagentoConfiguration = config,
) {
  const quote: MagentoCart = {
    id: 1,
    masked_id: CART_KEY,
    items: [],
    customer: {},
    billing_address: billingAddressStub,
  };
  const totals: MagentoCartTotals = { grand_total: 10, quote_currency_code: 'EUR' };
  let activeCartId: string | null = CART_KEY;
  const placeOrder = vi.fn<MagentoClient['placeOrder']>(async () => 1001);
  const setCheckoutBillingAddress = vi.fn(
    async (_cartId: string | null, address: MagentoCheckoutAddress) => {
      quote.billing_address = { ...address };
      return 1;
    },
  );
  const estimateShippingMethods = vi.fn<MagentoClient['estimateShippingMethods']>(
    async () => [FLATRATE],
  );

  const setShippingInformation = vi.fn<MagentoClient['setShippingInformation']>(
    async () => ({}),
  );

  function request() {
    const session = new Map<string, MagentoCheckoutState>();
    const sessionItems = new Map<string, string>();
    const magentoApi = {
      getSessionItem: vi.fn(async (key: string) => sessionItems.get(key) ?? null),
      setSessionItem: vi.fn(async (key: string, value: string) => {
        sessionItems.set(key, value);
      }),
      getCart: vi.fn(async () => structuredClone(quote)),
      getCartTotals: vi.fn(async () => structuredClone(totals)),
      getActiveCartId: vi.fn(async () => activeCartId),
      getPaymentMethods: vi.fn<MagentoClient['getPaymentMethods']>(async () => [
        { code: 'checkmo', title: 'Check / Money order' },
      ]),
      getCheckoutState: vi.fn(async (key: string) => structuredClone(session.get(key) ?? {})),
      setCheckoutState: vi.fn(async (key: string, state: MagentoCheckoutState) => {
        session.set(key, structuredClone(state));
      }),
      setCheckoutBillingAddress,
      estimateShippingMethods,
      setShippingInformation,
      placeOrder,
      clearActiveCartId: vi.fn(async () => {
        activeCartId = null;
      }),
    };
    const capability = new MagentoCheckoutCapability(
      backendConfig,
      new NoOpCache(),
      createInitialRequestContext(),
      magentoApi as unknown as MagentoClient,
      new MagentoCheckoutFactory(
        CheckoutSchema,
        ShippingMethodSchema,
        PaymentMethodSchema,
        backendConfig,
      ),
    );
    return { capability, magentoApi, session };
  }

  return {
    quote,
    totals,
    getActiveCartId: () => activeCartId,
    setActiveCartId: (key: string | null) => {
      activeCartId = key;
    },
    request,
    placeOrder,
    setCheckoutBillingAddress,
    estimateShippingMethods,
    setShippingInformation,
  };
}

/** What Magento returns for a fresh quote: country pre-filled, everything else null. */
const MAGENTO_STUB = {
  id: 7,
  country_id: 'EE',
  firstname: null,
  lastname: null,
  street: [''],
  city: null,
  postcode: null,
  email: null,
};

describe('MagentoCheckoutCapability durability across requests', () => {
  it('keeps the notification email across two separate requests', async () => {
    const backend = createBackend(MAGENTO_STUB);

    const first = await backend
      .request()
      .capability.initiateCheckoutForCart({ cart: CART_INPUT, notificationEmail: EMAIL });
    expect(first).toMatchObject({ success: true });
    expect(backend.setCheckoutBillingAddress).toHaveBeenCalledWith(CART_KEY, {
      country_id: 'EE',
      email: EMAIL,
    });

    const second = await backend.request().capability.getById({ identifier: { key: CART_KEY } });
    expect(second).toMatchObject({ success: true });
    if (second.success) {
      expect(second.value.pointOfContact.email).toBe(EMAIL);
    }
  });

  it('does not invent a country when the quote carries none', async () => {
    const backend = createBackend(undefined);

    const result = await backend
      .request()
      .capability.initiateCheckoutForCart({ cart: CART_INPUT, notificationEmail: EMAIL });

    expect(result).toMatchObject({ success: true });
    expect(backend.setCheckoutBillingAddress).not.toHaveBeenCalled();
  });

  it('rebuilds the address from the quote on a fresh request', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend
      .request()
      .capability.initiateCheckoutForCart({ cart: CART_INPUT, notificationEmail: EMAIL });
    const set = await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: SHIPPING_ADDRESS,
    });
    expect(set).toMatchObject({ success: true });

    const { capability } = backend.request();
    const methods = await capability.getAvailableShippingMethods({
      checkout: { key: CART_KEY },
    });
    expect(methods).toMatchObject({ success: true });
    if (methods.success) {
      expect(methods.value.map((m) => m.identifier.key)).toEqual(['flatrate_flatrate']);
    }
    expect(backend.estimateShippingMethods).toHaveBeenLastCalledWith(
      CART_KEY,
      expect.objectContaining({ city: 'Tallinn', country_id: 'EE', email: EMAIL }),
    );

    const checkout = await capability.getById({ identifier: { key: CART_KEY } });
    expect(checkout).toMatchObject({ success: true });
    if (checkout.success) {
      expect(checkout.value.pointOfContact.email).toBe(EMAIL);
      expect(checkout.value.billingAddress?.city).toBe('Tallinn');
    }
  });

  it('uses a shipping address changed in a later request', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend
      .request()
      .capability.initiateCheckoutForCart({ cart: CART_INPUT, notificationEmail: EMAIL });
    await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: SHIPPING_ADDRESS,
    });
    await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: { ...SHIPPING_ADDRESS, city: 'Tartu' },
    });

    await backend.request().capability.getAvailableShippingMethods({
      checkout: { key: CART_KEY },
    });
    expect(backend.estimateShippingMethods).toHaveBeenLastCalledWith(
      CART_KEY,
      expect.objectContaining({ city: 'Tartu' }),
    );

    const selected = await backend.request().capability.setShippingInstruction({
      checkout: { key: CART_KEY },
      shippingInstruction: {
        shippingMethod: { key: 'flatrate_flatrate' },
        pickupPoint: '',
        instructions: '',
        consentForUnattendedDelivery: false,
      },
    });
    expect(selected).toMatchObject({ success: true });
    expect(backend.setShippingInformation).toHaveBeenLastCalledWith(CART_KEY, {
      addressInformation: expect.objectContaining({
        shipping_address: expect.objectContaining({ city: 'Tartu' }),
      }),
    });
  });

  it('keeps the saved quote address intact when only the email changes', async () => {
    const savedAddress = {
      id: 7,
      customer_address_id: 3,
      firstname: 'Jane',
      lastname: 'Doe',
      company: 'ACME',
      street: ['Main St', '1'],
      city: 'Tallinn',
      region: 'Harju',
      region_id: 12,
      region_code: 'HAR',
      postcode: '10111',
      country_id: 'EE',
      telephone: '5551234',
      email: 'old@example.com',
    };
    const backend = createBackend(savedAddress);

    await backend
      .request()
      .capability.initiateCheckoutForCart({ cart: CART_INPUT, notificationEmail: EMAIL });

    expect(backend.setCheckoutBillingAddress).toHaveBeenCalledWith(
      CART_KEY,
      expect.objectContaining({
        customer_address_id: 3,
        company: 'ACME',
        region_id: 12,
        region_code: 'HAR',
        email: EMAIL,
      }),
    );
  });
});

describe('MagentoCheckoutCapability.finalizeCheckout', () => {
  async function readyCheckout(
    protocolData: Array<{ key: string; value: string }>,
    backendConfig: MagentoConfiguration = config,
  ) {
    const backend = createBackend(MAGENTO_STUB, backendConfig);
    const req = backend.request();
    await req.capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      notificationEmail: EMAIL,
      billingAddress: SHIPPING_ADDRESS,
    });
    await req.capability.setShippingInstruction({
      checkout: { key: CART_KEY },
      shippingInstruction: {
        shippingMethod: { key: 'flatrate_flatrate' },
        pickupPoint: '',
        instructions: '',
        consentForUnattendedDelivery: false,
      },
    });
    await req.capability.addPaymentInstruction({
      checkout: { key: CART_KEY },
      paymentInstruction: {
        paymentMethod: { method: 'psp', name: 'PSP', paymentProcessor: 'psp' },
        amount: { value: 10, currency: 'EUR' },
        protocolData,
      },
    });
    return { backend, capability: req.capability, magentoApi: req.magentoApi };
  }

  it('remembers the placed order in the session so a guest can view it', async () => {
    const { capability, magentoApi } = await readyCheckout([]);
    const client = magentoApi as unknown as MagentoClient;

    expect(await wasMagentoOrderPlacedInSession(client, 1001)).toBe(false);
    const result = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(result.success).toBe(true);
    expect(await wasMagentoOrderPlacedInSession(client, 1001)).toBe(true);
  });

  it('places the order only once when finalized twice', async () => {
    const { backend, capability } = await readyCheckout([]);

    const first = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    const second = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(backend.placeOrder).toHaveBeenCalledTimes(1);
    expect(first.success && first.value.resultingOrder?.key).toBe('1001');
    expect(second.success && second.value.resultingOrder?.key).toBe('1001');
  });

  it('forwards payment protocolData as additional_data', async () => {
    const { backend, capability } = await readyCheckout([
      { key: 'transaction_id', value: 'tx-123' },
      { key: 'provider', value: 'acme' },
    ]);

    await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(backend.placeOrder).toHaveBeenCalledWith(
      CART_KEY,
      expect.objectContaining({
        paymentMethod: {
          method: 'psp',
          additional_data: { transaction_id: 'tx-123', provider: 'acme' },
        },
      }),
    );
  });

  it('omits additional_data when there is no protocolData', async () => {
    const { backend, capability } = await readyCheckout([]);

    await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(backend.placeOrder).toHaveBeenCalledWith(
      CART_KEY,
      expect.objectContaining({ paymentMethod: { method: 'psp' } }),
    );
  });

  it('sends the configured checkout agreement ids with the payment method', async () => {
    const { backend, capability } = await readyCheckout(
      [{ key: 'transaction_id', value: 'tx-123' }],
      { ...config, checkoutAgreementIds: ['3'] },
    );

    await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(backend.placeOrder).toHaveBeenCalledWith(
      CART_KEY,
      expect.objectContaining({
        paymentMethod: {
          method: 'psp',
          additional_data: { transaction_id: 'tx-123' },
          extension_attributes: { agreement_ids: ['3'] },
        },
      }),
    );
  });

  it('sends agreement ids even without protocolData', async () => {
    const { backend, capability } = await readyCheckout([], {
      ...config,
      checkoutAgreementIds: ['3', '5'],
    });

    await capability.finalizeCheckout({ checkout: { key: CART_KEY } });

    expect(backend.placeOrder).toHaveBeenCalledWith(
      CART_KEY,
      expect.objectContaining({
        paymentMethod: {
          method: 'psp',
          extension_attributes: { agreement_ids: ['3', '5'] },
        },
      }),
    );
  });
});

function apiError(status: number, message = 'boom'): MagentoApiError {
  return new MagentoApiError({
    transport: 'rest',
    status,
    method: 'POST',
    url: 'https://example.com/rest/V1/x',
    magentoMessage: message,
  });
}

const SHIPPING_INSTRUCTION = {
  shippingMethod: { key: 'flatrate_flatrate' },
  pickupPoint: '',
  instructions: '',
  consentForUnattendedDelivery: false,
};

const PAYMENT = {
  paymentMethod: { method: 'psp', name: 'PSP', paymentProcessor: 'psp' },
  amount: { value: 10, currency: 'EUR' as const },
  protocolData: [],
};

describe('MagentoCheckoutCapability addresses', () => {
  it('sends the notification phone as the address telephone', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend.request().capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      notificationEmail: EMAIL,
      notificationPhone: '+372 5551234',
      billingAddress: SHIPPING_ADDRESS,
    });
    expect(backend.setCheckoutBillingAddress).toHaveBeenLastCalledWith(
      CART_KEY,
      expect.objectContaining({ telephone: '+372 5551234' }),
    );
  });

  it('falls back to the placeholder telephone Magento requires by default', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend.request().capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      billingAddress: SHIPPING_ADDRESS,
    });
    expect(backend.setCheckoutBillingAddress).toHaveBeenLastCalledWith(
      CART_KEY,
      expect.objectContaining({ telephone: '000' }),
    );
  });

  it('sends no telephone when the fallback is configured empty', async () => {
    const backend = createBackend(MAGENTO_STUB, { ...config, checkoutTelephoneFallback: '' });
    await backend.request().capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      billingAddress: SHIPPING_ADDRESS,
    });
    const sent = backend.setCheckoutBillingAddress.mock.lastCall?.[1];
    expect(sent?.telephone).toBeUndefined();
  });

  it('reuses the phone stored on the quote in a later request', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend.request().capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      notificationEmail: EMAIL,
      notificationPhone: '5551234',
      billingAddress: SHIPPING_ADDRESS,
    });
    await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: SHIPPING_ADDRESS,
    });
    expect(backend.setCheckoutBillingAddress).toHaveBeenLastCalledWith(
      CART_KEY,
      expect.objectContaining({ telephone: '5551234' }),
    );
  });
});

describe('MagentoCheckoutCapability typed errors', () => {
  it('maps only a Magento 404 in getById to NotFound', async () => {
    const backend = createBackend(MAGENTO_STUB);
    const notFound = backend.request();
    notFound.magentoApi.getCart.mockRejectedValue(apiError(404));
    expect(await notFound.capability.getById({ identifier: { key: CART_KEY } })).toMatchObject({
      success: false,
      error: { type: 'NotFound' },
    });

    const failing = backend.request();
    failing.magentoApi.getCart.mockRejectedValue(apiError(500));
    expect(await failing.capability.getById({ identifier: { key: CART_KEY } })).toMatchObject({
      success: false,
      error: { type: 'Generic' },
    });
  });

  it('propagates a totals failure instead of reporting zero prices', async () => {
    const backend = createBackend(MAGENTO_STUB);
    const req = backend.request();
    req.magentoApi.getCartTotals.mockRejectedValue(apiError(503));
    expect(await req.capability.getById({ identifier: { key: CART_KEY } })).toMatchObject({
      success: false,
      error: { type: 'Generic' },
    });
  });

  it('returns a typed error when estimating shipping methods fails', async () => {
    const backend = createBackend(MAGENTO_STUB);
    await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: SHIPPING_ADDRESS,
    });
    backend.estimateShippingMethods.mockRejectedValueOnce(apiError(400, 'Invalid address'));
    const result = await backend
      .request()
      .capability.getAvailableShippingMethods({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({
      success: false,
      error: { type: 'InvalidInput', error: 'Invalid address' },
    });
  });

  it('returns a typed error when listing payment methods fails', async () => {
    const backend = createBackend(MAGENTO_STUB);
    const req = backend.request();
    req.magentoApi.getPaymentMethods.mockRejectedValueOnce(apiError(500));
    const result = await req.capability.getAvailablePaymentMethods({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });
});

describe('MagentoCheckoutCapability shipping methods', () => {
  it('prices rates in the quote currency, not the configured default', async () => {
    const backend = createBackend(MAGENTO_STUB);
    backend.totals.quote_currency_code = 'DKK';
    await backend.request().capability.setShippingAddress({
      checkout: { key: CART_KEY },
      shippingAddress: SHIPPING_ADDRESS,
    });
    const result = await backend
      .request()
      .capability.getAvailableShippingMethods({ checkout: { key: CART_KEY } });
    expect(result.success && result.value[0].price).toEqual({ value: 5, currency: 'DKK' });
  });

  it('reads a delivery estimate from the method title', () => {
    const factory = new MagentoCheckoutFactory(
      CheckoutSchema,
      ShippingMethodSchema,
      PaymentMethodSchema,
      config,
    );
    const context = createInitialRequestContext();
    const titled = factory.parseShippingMethod(context, {
      ...FLATRATE,
      method_title: 'Ground (3-5 business days)',
    });
    expect(titled.deliveryTime).toBe('3-5 business days');

    const plain = factory.parseShippingMethod(context, FLATRATE);
    expect(plain.deliveryTime).toBe('');
  });
});

describe('MagentoCheckoutCapability payment instructions', () => {
  async function checkoutWithShipping() {
    const backend = createBackend(MAGENTO_STUB);
    const req = backend.request();
    await req.capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      notificationEmail: EMAIL,
      billingAddress: SHIPPING_ADDRESS,
    });
    await req.capability.setShippingInstruction({
      checkout: { key: CART_KEY },
      shippingInstruction: SHIPPING_INSTRUCTION,
    });
    return { backend, capability: req.capability };
  }

  it('gives every payment instruction a unique key', async () => {
    const { capability } = await checkoutWithShipping();
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      await capability.addPaymentInstruction({ checkout: { key: CART_KEY }, paymentInstruction: PAYMENT });
      const second = await capability.addPaymentInstruction({
        checkout: { key: CART_KEY },
        paymentInstruction: PAYMENT,
      });
      const keys = second.success ? second.value.paymentInstructions.map((p) => p.identifier.key) : [];
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
      for (const key of keys) {
        expect(key).toMatch(/^pi_[0-9a-f-]{36}$/);
      }
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('rejects an amount that differs from the quote grand total', async () => {
    const { capability } = await checkoutWithShipping();
    const result = await capability.addPaymentInstruction({
      checkout: { key: CART_KEY },
      paymentInstruction: { ...PAYMENT, amount: { value: 9.5, currency: 'EUR' } },
    });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
  });

  it('rejects a currency that differs from the quote currency', async () => {
    const { capability } = await checkoutWithShipping();
    const result = await capability.addPaymentInstruction({
      checkout: { key: CART_KEY },
      paymentInstruction: { ...PAYMENT, amount: { value: 10, currency: 'USD' } },
    });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
  });

  it('reports the payment as pending before and authorized after the order', async () => {
    const { capability } = await checkoutWithShipping();
    const added = await capability.addPaymentInstruction({
      checkout: { key: CART_KEY },
      paymentInstruction: PAYMENT,
    });
    expect(added.success && added.value.paymentInstructions[0].status).toBe('pending');

    const finalized = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(finalized.success && finalized.value.paymentInstructions[0].status).toBe('authorized');
  });
});

describe('MagentoCheckoutCapability.finalizeCheckout errors', () => {
  it('returns InvalidInput instead of throwing when the checkout is not ready', async () => {
    const backend = createBackend(MAGENTO_STUB);
    const result = await backend
      .request()
      .capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
    expect(backend.placeOrder).not.toHaveBeenCalled();
  });

  async function readyCheckout() {
    const backend = createBackend(MAGENTO_STUB);
    const req = backend.request();
    await req.capability.initiateCheckoutForCart({
      cart: CART_INPUT,
      notificationEmail: EMAIL,
      billingAddress: SHIPPING_ADDRESS,
    });
    await req.capability.setShippingInstruction({
      checkout: { key: CART_KEY },
      shippingInstruction: SHIPPING_INSTRUCTION,
    });
    await req.capability.addPaymentInstruction({
      checkout: { key: CART_KEY },
      paymentInstruction: PAYMENT,
    });
    return { backend, capability: req.capability };
  }

  it('rejects the order when the grand total moved after the payment was added', async () => {
    const { backend, capability } = await readyCheckout();
    backend.totals.grand_total = 15;
    const result = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
    expect(backend.placeOrder).not.toHaveBeenCalled();
  });

  it('maps a rejected order placement to InvalidInput', async () => {
    const { backend, capability } = await readyCheckout();
    backend.placeOrder.mockRejectedValueOnce(apiError(400, 'The payment method is not available'));
    const result = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({
      success: false,
      error: { type: 'InvalidInput', error: 'The payment method is not available' },
    });
  });

  it('maps a failed order placement to Generic', async () => {
    const { backend, capability } = await readyCheckout();
    backend.placeOrder.mockRejectedValueOnce(apiError(500));
    const result = await capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });

  it('clears the active cart only when it is the checked-out cart', async () => {
    const own = await readyCheckout();
    await own.capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(own.backend.getActiveCartId()).toBeNull();

    const other = await readyCheckout();
    other.backend.setActiveCartId('another-cart');
    await other.capability.finalizeCheckout({ checkout: { key: CART_KEY } });
    expect(other.backend.getActiveCartId()).toBe('another-cart');
  });
});
