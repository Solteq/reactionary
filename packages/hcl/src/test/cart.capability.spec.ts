import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CartSchema,
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclCartFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import type { HclWcsIdentityResponse } from '../schema/hcl.schema.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

/** Test SKU from PLAYBOOK. */
const TEST_PART_NUMBER = 'DR-CHRS-0001-0001';

describe('HCL Cart Capability', () => {
  let provider: HclCartCapability;
  let reqCtx: RequestContext;
  let hclClient: HclClient;

  beforeEach(async () => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    hclClient = new HclClient(config, reqCtx);
    provider = new HclCartCapability(
      new NoOpCache(),
      reqCtx,
      config,
      hclClient,
      new HclCartFactory(
        CartSchema,
        CartIdentifierSchema,
        CartPaginatedSearchResultSchema,
      ),
    );

    // Establish a guest session so cart operations are authenticated.
    const guest = await hclClient.callPost<HclWcsIdentityResponse>(
      `${hclClient.transactionBaseUrl}/guestidentity`,
    );
    reqCtx.session['hcl.WCToken'] = guest.WCToken;
    reqCtx.session['hcl.WCTrustedToken'] = guest.WCTrustedToken;
    reqCtx.session['hcl.userId'] = guest.userId;
    reqCtx.session['hcl.identityType'] = 'guest';
    if (guest.personalizationID) {
      reqCtx.session['hcl.personalizationID'] = guest.personalizationID;
    }
  });

  afterEach(async () => {
    // Clean up: delete the cart after each test so tests stay independent.
    try {
      await provider.deleteCart({ cart: { key: '' } });
    } catch {
      // ignore — cart may already be gone
    }
  });

  it('should add an item and return the updated cart', async () => {
    const result = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;

    expect(result.value.identifier.key).toBeTruthy();
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].variant.sku).toBe(TEST_PART_NUMBER);
    expect(result.value.items[0].quantity).toBe(1);
  });

  it('should get the cart by id', async () => {
    const addResult = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const orderId = addResult.value.identifier.key;
    const result = await provider.getById({ cart: { key: orderId } });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.identifier.key).toBe(orderId);
    expect(result.value.items).toHaveLength(1);
  });

  it('should return the active cart id', async () => {
    await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });

    const result = await provider.getActiveCartId();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.key).toBeTruthy();
  });

  it('should change the quantity of a cart item', async () => {
    const addResult = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const orderItemId = addResult.value.items[0].identifier.key;
    const orderId = addResult.value.identifier.key;

    const result = await provider.changeQuantity({
      cart: { key: orderId },
      item: { key: orderItemId },
      quantity: 3,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items[0].quantity).toBe(3);
  });

  it('should remove an item from the cart', async () => {
    const addResult = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 2,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;

    const orderItemId = addResult.value.items[0].identifier.key;
    const orderId = addResult.value.identifier.key;

    const result = await provider.remove({
      cart: { key: orderId },
      item: { key: orderItemId },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items).toHaveLength(0);
  });

  it('should list carts and return the active cart in a paginated result', async () => {
    await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });

    const result = await provider.listCarts({
      search: { paginationOptions: { pageNumber: 1, pageSize: 10 } },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].identifier.key).toBeTruthy();
    expect(result.value.totalCount).toBeGreaterThan(0);
  });

  it('should create a virtual empty cart', async () => {
    const result = await provider.createCart({ name: 'My Cart' });

    if (!result.success)
      console.error('DEBUG CART FAILURE:', JSON.stringify(result));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.name).toBe('My Cart');
    // No WCS cart created yet — orderId is empty
    expect(result.value.items).toHaveLength(0);
  });

  it('should delete the cart', async () => {
    await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });

    const result = await provider.deleteCart({ cart: { key: '' } });

    expect(result.success).toBe(true);
  });

  it('should rename the cart (stored in session)', async () => {
    const addResult = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const orderId = addResult.value.identifier.key;

    const result = await provider.renameCart({
      cart: { key: orderId },
      newName: 'Renamed Cart',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.name).toBe('Renamed Cart');
  });

  it('should change the cart currency by creating a new order with items copied', async () => {
    const addResult = await provider.add({
      cart: { key: '' },
      variant: { sku: TEST_PART_NUMBER },
      quantity: 1,
    });
    expect(addResult.success).toBe(true);
    if (!addResult.success) return;
    const oldOrderId = addResult.value.identifier.key;

    const result = await provider.changeCurrency({
      cart: { key: oldOrderId },
      newCurrency: 'USD',
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    // A new order is created — the key is different from the old one.
    expect(result.value.identifier.key).toBeTruthy();
    expect(result.value.identifier.key).not.toBe(oldOrderId);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].variant.sku).toBe(TEST_PART_NUMBER);
    expect(result.value.items[0].price.unitPrice.currency).toBe('USD');
  });
});
