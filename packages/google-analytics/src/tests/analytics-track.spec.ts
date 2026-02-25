import {
  createInitialRequestContext,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationPurchaseEvent,
} from '@reactionary/core';
import { initialize, type GoogleAnalyticsConfiguration } from '../index.js';

describe('google-analytics analytics track', () => {
  const config = {
    apiSecret: 'api-secret',
    measurementId: 'measurement-id',
    url: 'https://www.google-analytics.com/mp/collect',
  } satisfies GoogleAnalyticsConfiguration;

  const request = createInitialRequestContext();

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);
  });

  it('maps product summary view to view_item_list', async () => {
    const withContext = initialize(config);
    const client = withContext({ request });

    const event = {
      event: 'product-summary-view',
      products: [{ key: 'P-5000' }],
    } satisfies AnalyticsMutationProductSummaryViewEvent;

    const result = await client.analytics.track.execute(event);

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://www.google-analytics.com/mp/collect?measurement_id=measurement-id&api_secret=api-secret',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    );

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);

    expect(body.events[0].name).toBe('view_item_list');
    expect(body.events[0].params.items).toEqual([{ item_id: 'P-5000' }]);
  });

  it('maps purchase to purchase event payload', async () => {
    const withContext = initialize(config);
    const client = withContext({ request });

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
        ],
        price: {
          totalTax: { value: 21.99, currency: 'EUR' },
          totalDiscount: { value: 0, currency: 'EUR' },
          totalSurcharge: { value: 0, currency: 'EUR' },
          totalShipping: { value: 4.99, currency: 'EUR' },
          totalProductPrice: { value: 59.98, currency: 'EUR' },
          grandTotal: { value: 86.96, currency: 'EUR' },
        },
        orderStatus: 'AwaitingPayment',
        inventoryStatus: 'Allocated',
        paymentInstructions: [],
      },
    } satisfies AnalyticsMutationPurchaseEvent;

    const result = await client.analytics.track.execute(event);

    expect(result.success).toBe(true);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);

    expect(body.events[0].name).toBe('purchase');
    expect(body.events[0].params.transaction_id).toBe('ORDER-12345');
    expect(body.events[0].params.items).toEqual([
      {
        item_id: 'SKU-001',
        quantity: 2,
        price: 29.99,
      },
    ]);
  });
});
