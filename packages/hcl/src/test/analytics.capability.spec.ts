import 'dotenv/config';
import type {
  AnalyticsMutationPurchaseEvent,
  RequestContext,
} from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it, beforeEach } from 'vitest';
import { HclAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
const testData = {
  product: { key: 'DR-CHRS-0001' },
  variant: { sku: 'DR-CHRS-0001-0001' },
};

describe('HCL Analytics Capability', () => {
  let provider: HclAnalyticsCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config, reqCtx);
    provider = new HclAnalyticsCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
    );
  });

  it('should track a product-summary-view event', async () => {
    const result = await provider.track({
      event: 'product-summary-view',
      products: [testData.product],
    });

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should track a product-summary-click event', async () => {
    const result = await provider.track({
      event: 'product-summary-click',
      product: testData.product,
      position: 0,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should track a product-details-view event', async () => {
    const result = await provider.track({
      event: 'product-details-view',
      product: testData.product,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should track a product-cart-add event', async () => {
    const result = await provider.track({
      event: 'product-cart-add',
      product: testData.product,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should track a purchase event', async () => {
    const event = {
      event: 'purchase',
      order: {
        identifier: { key: 'TEST-ORDER-001' },
        userId: { userId: 'test-user-anonymous' },
        items: [
          {
            identifier: { key: 'item-1' },
            variant: testData.variant,
            quantity: 1,
            price: {
              unitPrice: { value: 99.99, currency: 'USD' },
              unitDiscount: { value: 0, currency: 'USD' },
              totalPrice: { value: 99.99, currency: 'USD' },
              totalDiscount: { value: 0, currency: 'USD' },
            },
            inventoryStatus: 'Allocated',
          },
        ],
        price: {
          totalTax: { value: 10, currency: 'USD' },
          totalDiscount: { value: 0, currency: 'USD' },
          totalSurcharge: { value: 0, currency: 'USD' },
          totalShipping: { value: 5, currency: 'USD' },
          totalProductPrice: { value: 99.99, currency: 'USD' },
          grandTotal: { value: 114.99, currency: 'USD' },
        },
        orderStatus: 'AwaitingPayment',
        inventoryStatus: 'Allocated',
        paymentInstructions: [],
      },
    } satisfies AnalyticsMutationPurchaseEvent;

    const result = await provider.track(event);

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should include provider name in outcomes', async () => {
    const result = await provider.track({
      event: 'product-summary-view',
      products: [testData.product],
    });

    expect(result.outcomes[0].provider).toBeTruthy();
  });
});
