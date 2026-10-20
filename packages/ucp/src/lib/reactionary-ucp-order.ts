import type { Address, Order } from '@reactionary/core';
import * as z from 'zod';
import type { ReactionaryUCPClient } from './reactionary-ucp-common.js';
import {
  createUCPError,
  createUcpSuccessMetadata,
  getMoneyCurrency,
  toOrderPermalinkUrl,
  toUcpCartLineItem,
  toUcpCostTotals,
  type UCPPostalAddress,
} from './reactionary-ucp-mapping.js';
import {
  UCPAdjustmentSchema,
  UCPFulfillmentEventSchema,
  type ReactionaryUCPSessionStore,
  type UCPOrderState,
} from './reactionary-ucp-session-store.js';
import type { ReactionaryUCPWebhooks } from './reactionary-ucp-webhooks.js';
import type { components } from './ucp-shopping.openapi.js';

type UCPErrorResponse = components['schemas']['error_response'];
type UCPOrder = Omit<components['schemas']['order'], '$defs'>;
type UCPOrderLineItem = components['schemas']['order_line_item'];
export type UCPOrderResponse = UCPOrder | UCPErrorResponse;

/**
 * The parts of a PUT /orders/{id} body applied by testOrderUpdates: the
 * fulfillment event log and the adjustments, each replaced as a whole.
 */
export const UCPOrderUpdateSchema = z.looseObject({
  fulfillment: z.looseObject({
    events: z.array(UCPFulfillmentEventSchema).optional(),
  }).optional(),
  adjustments: z.array(UCPAdjustmentSchema).optional(),
});

export type UCPOrderUpdate = z.infer<typeof UCPOrderUpdateSchema>;

export interface UCPOrderContext {
  client: ReactionaryUCPClient;
  store: ReactionaryUCPSessionStore;
  merchantUrl?: string;
  webhooks?: ReactionaryUCPWebhooks;
}

/**
 * The backend scopes orders to the session's identity (the session that
 * placed the order, or a linked identity), so an order this session may not
 * see is not found rather than forbidden.
 */
export async function getOrder(
  context: UCPOrderContext,
  orderId: string,
): Promise<UCPOrderResponse> {
  const result = await getBackendOrder(context, orderId);

  if (!('identifier' in result)) {
    return result;
  }

  return toUcpOrder(context, result, await context.store.getOrder(orderId));
}

/**
 * Test-only: records fulfillment events and adjustments on an order placed
 * through a UCP checkout session, as a business would post them.
 */
export async function updateOrder(
  context: UCPOrderContext,
  orderId: string,
  update: UCPOrderUpdate,
): Promise<UCPOrderResponse> {
  const result = await getBackendOrder(context, orderId);
  const state = await context.store.getOrder(orderId);

  if (!('identifier' in result)) {
    return result;
  }

  if (!state) {
    return createUCPError('not_found', `Order was not placed through a UCP checkout session: ${orderId}`);
  }

  const updated: UCPOrderState = {
    ...state,
    ...(update.fulfillment?.events ? { events: update.fulfillment.events } : {}),
    ...(update.adjustments ? { adjustments: update.adjustments } : {}),
  };
  await context.store.putOrder(updated);

  const order = toUcpOrder(context, result, updated);
  notifyOrder(context, updated, order);

  return order;
}

/**
 * Test-only: records a shipment of every line item, as a business would
 * when the order ships, and notifies the platform.
 */
export async function simulateShipping(
  context: UCPOrderContext,
  orderId: string,
): Promise<UCPOrderResponse> {
  const result = await getBackendOrder(context, orderId);
  const state = await context.store.getOrder(orderId);

  if (!('identifier' in result)) {
    return result;
  }

  if (!state) {
    return createUCPError('not_found', `Order was not placed through a UCP checkout session: ${orderId}`);
  }

  return updateOrder(context, orderId, {
    fulfillment: {
      events: [
        ...state.events,
        {
          id: `evt_${crypto.randomUUID()}`,
          occurred_at: new Date().toISOString(),
          type: 'shipped',
          line_items: result.items
            .filter((item) => item.quantity > 0)
            .map((item) => ({ id: item.identifier.key, quantity: item.quantity })),
          tracking_number: `SIM-${orderId}`,
          description: 'Simulated shipment',
        },
      ],
    },
  });
}

/**
 * Sends the "Order created" event for a newly placed order, resolving the
 * platform's webhook URL from its profile.
 */
export async function notifyOrderPlaced(
  context: UCPOrderContext,
  orderId: string,
): Promise<void> {
  const state = await context.store.getOrder(orderId);

  if (!context.webhooks || !state?.agentProfile) {
    return;
  }

  const webhookUrl = await context.webhooks.resolveOrderWebhookUrl(state.agentProfile);

  if (!webhookUrl) {
    return;
  }

  const placed = { ...state, webhookUrl };
  await context.store.putOrder(placed);

  const order = await getOrder(context, orderId);
  if ('id' in order) {
    notifyOrder(context, placed, order);
  }
}

/** Order events carry the full current-state order entity, never a delta. */
function notifyOrder(context: UCPOrderContext, state: UCPOrderState, order: UCPOrder): void {
  if (context.webhooks && state.webhookUrl) {
    context.webhooks.deliver(state.webhookUrl, order);
  }
}

async function getBackendOrder(
  context: UCPOrderContext,
  orderId: string,
): Promise<Order | UCPErrorResponse> {
  if (!context.client.order) {
    return createUCPError('not_available', 'Order capability is not available.');
  }

  const result = await context.client.order.getById({ order: { key: orderId } });

  return result.success
    ? result.value
    : createUCPError('not_found', `Order was not found: ${orderId}`);
}

function toUcpOrder(
  context: UCPOrderContext,
  order: Order,
  state: UCPOrderState | undefined,
): UCPOrder {
  const events = state?.events ?? [];
  const lineItems = order.items.map((item): UCPOrderLineItem => {
    const total = item.quantity;
    const shipped = events
      .filter((event) => event.type === 'shipped')
      .flatMap((event) => event.line_items)
      .filter((reference) => reference.id === item.identifier.key)
      .reduce((sum, reference) => sum + reference.quantity, 0);
    const fulfilled = Math.min(shipped, total);

    return {
      ...toUcpCartLineItem(item),
      quantity: { original: total, total, fulfilled },
      status: total === 0
        ? 'removed'
        : fulfilled === total ? 'fulfilled' : fulfilled > 0 ? 'partial' : 'processing',
    };
  });
  const destination = order.shippingAddress ? toUcpPostalAddress(order.shippingAddress) : state?.destination;
  const description = state?.fulfillmentTitle ?? order.shippingMethod?.name;

  return {
    ucp: createUcpSuccessMetadata(),
    id: order.identifier.key,
    checkout_id: state?.checkoutSessionId ?? '',
    permalink_url: toOrderPermalinkUrl(context.merchantUrl, order.identifier.key),
    line_items: lineItems,
    currency: getMoneyCurrency(order.price.grandTotal),
    totals: toUcpCostTotals(order.price, order.items),
    fulfillment: {
      expectations: destination
        ? [{
          id: 'expectation_1',
          line_items: lineItems.map((lineItem) => ({ id: lineItem.id, quantity: lineItem.quantity.total })),
          method_type: 'shipping',
          destination,
          ...(description ? { description } : {}),
          fulfillable_on: 'now',
        }]
        : [],
      events,
    },
    adjustments: state?.adjustments ?? [],
  };
}

function toUcpPostalAddress(address: Address): UCPPostalAddress {
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    street_address: [address.streetAddress, address.streetNumber].filter(Boolean).join(' '),
    address_locality: address.city,
    address_region: address.region,
    postal_code: address.postalCode,
    address_country: address.countryCode,
  };
}
