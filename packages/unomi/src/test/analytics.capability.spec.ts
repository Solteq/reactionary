import { config } from 'dotenv';
import type {
  AnalyticsMutationPurchaseEvent,
  RequestContext,
} from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnomiAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { UnomiConfigurationSchema } from '../schema/configuration.schema.js';

const testData = {
  product: {
    key: 'sku-1',
    productName: 'Cable',
    category: 'Cables',
    price: 12.5,
    currency: 'EUR',
    quantity: 2,
  },
  variant: { sku: 'sku-1' },
  scope: 'reactionary-storefront'
};

config({ path: '../../.env' });

describe('Unomi Analytics Capability', () => {
  let provider: UnomiAnalyticsCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    reqCtx.session.marketingContext.identifier.key = 'profile-hash';
    const cfg = UnomiConfigurationSchema.parse({
      apiUrl: process.env.UNOMI_API_URL!,
      scope: testData.scope,
      username: process.env.UNOMI_USERNAME!,
      password: process.env.UNOMI_PASSWORD!,
      profilePath: '/cxs/profiles',
    });
    provider = new UnomiAnalyticsCapability(
      new NoOpCache(),
      reqCtx,
      cfg
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
      product: { key: testData.product.key },
      position: 0,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  });

  it('should track a product-details-view event', async () => {
    const result = await provider.track({
      event: 'product-details-view',
      product: { key: testData.product.key },
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
        userId: { userId: 'test-user' },
        items: [
          {
            identifier: { key: 'item-1' },
            variant: testData.variant,
            quantity: 1,
            price: {
              unitPrice: { value: 99.99, currency: 'EUR' },
              unitDiscount: { value: 0, currency: 'EUR' },
              totalPrice: { value: 99.99, currency: 'EUR' },
              totalDiscount: { value: 0, currency: 'EUR' },
            },
            inventoryStatus: 'Allocated',
          },
        ],
        price: {
          totalTax: { value: 10, currency: 'EUR' },
          totalDiscount: { value: 0, currency: 'EUR' },
          totalSurcharge: { value: 0, currency: 'EUR' },
          totalShipping: { value: 5, currency: 'EUR' },
          totalProductPrice: { value: 99.99, currency: 'EUR' },
          grandTotal: { value: 114.99, currency: 'EUR' },
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
