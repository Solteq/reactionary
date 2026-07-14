import type { AnalyticsMutationProductSummaryViewEvent, AnalyticsMutationPurchaseEvent, RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalyticsAnalyticsCapability } from '../capabilities/analytics.capability.js';
import type { GoogleAnalyticsConfiguration } from '../schema/configuration.schema.js';

const fetchMock = vi.fn<typeof fetch>();

describe('Google Analytics Analytics Capability', () => {
  let capability: GoogleAnalyticsAnalyticsCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    reqCtx = createInitialRequestContext();
    const config = {
      apiSecret: 'test-api-secret',
      measurementId: 'G-TEST123',
      url: 'https://example.invalid/collect',
    } satisfies GoogleAnalyticsConfiguration;

    capability = new GoogleAnalyticsAnalyticsCapability(
      new NoOpCache(),
      reqCtx,
      config
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('tracking', () => {
    it('should be able to add an item to a cart', async () => {
        const event = {
            event: 'product-summary-view',
            products: [{
                key: 'P-5000'
            }]
        } satisfies AnalyticsMutationProductSummaryViewEvent;

        await capability.track(event);

        expect(fetchMock).toHaveBeenCalledWith(
          'https://example.invalid/collect?measurement_id=G-TEST123&api_secret=test-api-secret',
          expect.objectContaining({ method: 'POST' })
        );
    });

    it('should be able to track a purchase', async () => {
        const event = {
            event: 'purchase',
            order: {
                identifier: { key: 'ORDER-12345' },
                userId: { userId: 'test-user-123' },
                items: [
                    {
                        identifier: { key: 'item-1' },
                        variant: { sku: 'SKU-001' },
                        quantity: 2,
                        price: {
                            unitPrice: { value: 29.99, currency: 'EUR' },
                            unitDiscount: { value: 0, currency: 'EUR' },
                            totalPrice: { value: 59.98, currency: 'EUR' },
                            totalDiscount: { value: 0, currency: 'EUR' },
                        },
                        inventoryStatus: 'Allocated',
                    },
                    {
                        identifier: { key: 'item-2' },
                        variant: { sku: 'SKU-002' },
                        quantity: 1,
                        price: {
                            unitPrice: { value: 49.99, currency: 'EUR' },
                            unitDiscount: { value: 5, currency: 'EUR' },
                            totalPrice: { value: 44.99, currency: 'EUR' },
                            totalDiscount: { value: 5, currency: 'EUR' },
                        },
                        inventoryStatus: 'Allocated',
                    },
                ],
                price: {
                    totalTax: { value: 21.99, currency: 'EUR' },
                    totalDiscount: { value: 5, currency: 'EUR' },
                    totalSurcharge: { value: 0, currency: 'EUR' },
                    totalShipping: { value: 4.99, currency: 'EUR' },
                    totalProductPrice: { value: 104.97, currency: 'EUR' },
                    grandTotal: { value: 126.95, currency: 'EUR' },
                },
                orderStatus: 'AwaitingPayment',
                inventoryStatus: 'Allocated',
                paymentInstructions: [],
            },
        } satisfies AnalyticsMutationPurchaseEvent;

        await capability.track(event);

        expect(fetchMock).toHaveBeenCalledWith(
          'https://example.invalid/collect?measurement_id=G-TEST123&api_secret=test-api-secret',
          expect.objectContaining({ method: 'POST' })
        );
    });
  });
});
