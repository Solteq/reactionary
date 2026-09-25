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
import { MagentoCheckoutFactory } from '../factories/checkout/checkout.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoCart,
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
  storeCode: 'default',
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
    const magentoApi = {
      getCart: vi.fn(async () => structuredClone(quote)),
      getCartTotals: vi.fn(async () => undefined),
      getCheckoutState: vi.fn(async (key: string) => structuredClone(session.get(key) ?? {})),
      setCheckoutState: vi.fn(async (key: string, state: MagentoCheckoutState) => {
        session.set(key, structuredClone(state));
      }),
      setCheckoutBillingAddress,
      estimateShippingMethods,
      setShippingInformation,
      placeOrder,
      clearActiveCartId: vi.fn(async () => undefined),
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
    return { backend, capability: req.capability };
  }

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
