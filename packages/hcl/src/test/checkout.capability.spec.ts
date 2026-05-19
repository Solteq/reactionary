import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartSchema,
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CheckoutSchema,
  ShippingMethodSchema,
  PaymentMethodSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclCheckoutCapability } from '../capabilities/checkout.capability.js';
import { HclCartFactory, HclCheckoutFactory } from '../factories/index.js';
import { HclTransactionClient } from '../core/transaction-client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

/** Test SKU from PLAYBOOK. */
const TEST_PART_NUMBER = 'DR-CHRS-0001-0001';

describe('HCL Checkout Capability', () => {
  let cartProvider: HclCartCapability;
  let checkoutProvider: HclCheckoutCapability;
  let reqCtx: RequestContext;
  let transactionClient: HclTransactionClient;

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    transactionClient = new HclTransactionClient(config);

    cartProvider = new HclCartCapability(
      new NoOpCache(),
      reqCtx,
      config,
      transactionClient,
      new HclCartFactory(
        CartSchema,
        CartIdentifierSchema,
        CartPaginatedSearchResultSchema,
      ),
    );

    checkoutProvider = new HclCheckoutCapability(
      new NoOpCache(),
      reqCtx,
      config,
      transactionClient,
      new HclCheckoutFactory(
        CheckoutSchema,
        ShippingMethodSchema,
        PaymentMethodSchema,
      ),
    );

    // Establish a guest session.
    const guest = await transactionClient.createGuestIdentity();
    reqCtx.session['hcl.WCToken'] = guest.WCToken;
    reqCtx.session['hcl.WCTrustedToken'] = guest.WCTrustedToken;
    reqCtx.session['hcl.userId'] = guest.userId;
    reqCtx.session['hcl.identityType'] = 'guest';
    if (guest.personalizationID) {
      reqCtx.session['hcl.personalizationID'] = guest.personalizationID;
    }
  });

  afterEach(async () => {
    // Clean up: delete the cart after each test.
    try {
      await cartProvider.deleteCart({ cart: { key: '' } });
    } catch {
      // ignore
    }
  });

  it('should initiate checkout for cart and return a Checkout', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success, JSON.stringify(addResult)).toBe(true);
    if (!addResult.success) return;
    const cart = addResult.value;

    const result = await checkoutProvider.initiateCheckoutForCart({
      cart,
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(result.value.identifier.key).toBe(cart.identifier.key);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.originalCartReference.key).toBe(cart.identifier.key);
  });

  it('should get a checkout by id', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const result = await checkoutProvider.getById({
      identifier: { key: orderId },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.identifier.key).toBe(orderId);
  });

  it('should return available shipping methods', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const result = await checkoutProvider.getAvailableShippingMethods({
      checkout: { key: orderId },
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(result.value.length, JSON.stringify(result.value)).toBeGreaterThan(
      0,
    );
    expect(result.value[0].identifier.key).toBeTruthy();
    expect(result.value[0].name).toBeTruthy();
  });

  it('should set a shipping instruction', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const modesResult = await checkoutProvider.getAvailableShippingMethods({
      checkout: { key: orderId },
    });
    if (!modesResult.success)
      console.error(
        'DEBUG SHIPPING INSTRUCTION FAILURE:',
        JSON.stringify(modesResult),
      );
    expect(modesResult.success).toBe(true);
    if (!modesResult.success) return;
    expect(modesResult.value.length).toBeGreaterThan(0);

    const firstMode = modesResult.value[0];
    const result = await checkoutProvider.setShippingInstruction({
      checkout: { key: orderId },
      shippingInstruction: {
        shippingMethod: { key: firstMode.identifier.key },
        pickupPoint: '',
        instructions: '',
        consentForUnattendedDelivery: false,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.shippingInstruction).toBeTruthy();
    expect(result.value.shippingInstruction?.shippingMethod.key).toBe(
      firstMode.identifier.key,
    );
  });

  it('should return available payment methods', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const result = await checkoutProvider.getAvailablePaymentMethods({
      checkout: { key: orderId },
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(Array.isArray(result.value)).toBe(true);
  });

  it('should set a shipping address on the checkout', async () => {
    const addResult = await cartProvider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const result = await checkoutProvider.setShippingAddress({
      checkout: { key: orderId },
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        streetAddress: 'Test Street 1',
        streetNumber: '1',
        city: 'Helsinki',
        region: '',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
  });
});
