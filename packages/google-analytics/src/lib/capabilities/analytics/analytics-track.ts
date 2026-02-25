import {
  AnalyticsMutationSchema,
  success,
  type AnalyticsMutation,
  type AnalyticsTrackProcedureDefinition,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import {
  googleAnalyticsProcedure,
  type GoogleAnalyticsProcedureContext,
} from '../../core/context.js';

type GoogleAnalyticsEvent = {
  client_id: string;
  user_id: string;
  events: Array<{
    name: string;
    params: Record<string, unknown>;
  }>;
};

function getUserToken(context: RequestContext): string {
  return context.session.identityContext?.personalizationKey || 'anonymous';
}

function createEventPayload(
  event: AnalyticsMutation,
  context: RequestContext,
): GoogleAnalyticsEvent {
  const userToken = getUserToken(context);
  const currency = context.languageContext.currencyCode;

  switch (event.event) {
    case 'product-summary-view':
      return {
        client_id: userToken,
        user_id: userToken,
        events: [
          {
            name: 'view_item_list',
            params: {
              currency,
              items: event.products.map((product) => ({
                item_id: product.key,
              })),
            },
          },
        ],
      };
    case 'product-summary-click':
      return {
        client_id: userToken,
        user_id: userToken,
        events: [
          {
            name: 'select_item',
            params: {
              currency,
              items: [
                {
                  item_id: event.product.key,
                  index: event.position,
                },
              ],
            },
          },
        ],
      };
    case 'product-details-view':
      return {
        client_id: userToken,
        user_id: userToken,
        events: [
          {
            name: 'view_item',
            params: {
              currency,
              items: [
                {
                  item_id: event.product.key,
                },
              ],
            },
          },
        ],
      };
    case 'product-cart-add':
      return {
        client_id: userToken,
        user_id: userToken,
        events: [
          {
            name: 'add_to_cart',
            params: {
              currency,
              items: [
                {
                  item_id: event.product.key,
                },
              ],
            },
          },
        ],
      };
    case 'purchase':
      return {
        client_id: userToken,
        user_id: userToken,
        events: [
          {
            name: 'purchase',
            params: {
              currency,
              transaction_id: event.order.identifier.key,
              value: event.order.price.grandTotal.value,
              tax: event.order.price.totalTax.value,
              shipping: event.order.price.totalShipping.value,
              items: event.order.items.map((item) => ({
                item_id: item.variant.sku,
                quantity: item.quantity,
                price: item.price.unitPrice.value,
              })),
            },
          },
        ],
      };
  }
}

async function sendEvent(
  event: GoogleAnalyticsEvent,
  providerContext: GoogleAnalyticsProcedureContext,
): Promise<void> {
  const url = `${providerContext.config.url}?measurement_id=${providerContext.config.measurementId}&api_secret=${providerContext.config.apiSecret}`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
}

export const googleAnalyticsTrack = googleAnalyticsProcedure({
  inputSchema: AnalyticsMutationSchema,
  outputSchema: z.void(),
  fetch: async (event, ctx, providerContext) => {
    const payload = createEventPayload(event, ctx.request);
    await sendEvent(payload, providerContext);
    return success(undefined);
  },
  transform: async (_event, _ctx, data) => {
    return success(data);
  },
}) satisfies AnalyticsTrackProcedureDefinition<GoogleAnalyticsProcedureContext>;
