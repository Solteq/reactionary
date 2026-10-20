import {
  AddressIdentifierSchema,
  CurrencySchema,
  type Address,
  type Currency,
  type OrderInventoryStatus,
  type OrderStatus,
  type RequestContext,
} from '@reactionary/core';
import type {
  MagentoOrderDetail,
  MagentoOrderDetailAddress,
  MagentoOrderDetailItem,
} from '../../schema/order.types.js';

/**
 * Magento order states and the core status each one maps to. Every order
 * status, built-in or custom, is assigned to one of these states, so the
 * state is what the mapping (and the status filter of order search) keys on.
 *
 * - `new` / `pending_payment` / `payment_review`: not paid or not cleared yet.
 * - `holded`: put on hold before fulfilment; nothing is released, so it stays
 *   with the orders awaiting payment rather than claiming fulfilment.
 * - `processing`: invoiced or authorised and handed to fulfilment.
 * - `complete`: invoiced and fully shipped.
 * - `closed`: fully refunded through a credit memo. Core has no refunded
 *   status, and `Shipped` would present a refunded order as live; `Cancelled`
 *   is the closest match, since the order is void and its money returned.
 * - `canceled`: cancelled.
 */
export const MAGENTO_ORDER_STATE_STATUS: Readonly<Record<string, OrderStatus>> = {
  new: 'AwaitingPayment',
  pending_payment: 'AwaitingPayment',
  payment_review: 'AwaitingPayment',
  holded: 'AwaitingPayment',
  processing: 'ReleasedToFulfillment',
  complete: 'Shipped',
  closed: 'Cancelled',
  canceled: 'Cancelled',
};

/**
 * The built-in statuses whose code differs from their state's, used only when
 * a payload carries no recognisable state.
 */
const MAGENTO_STATUS_STATE: Readonly<Record<string, string>> = {
  pending: 'new',
  fraud: 'payment_review',
};

/**
 * Maps a Magento order onto a core order status, keyed on the order state
 * and falling back to the status code when the state is missing or custom.
 * An order with neither recognised is reported as `AwaitingPayment`, the one
 * status that does not claim payment or fulfilment.
 */
export function mapMagentoOrderStatus(status?: string, state?: string): OrderStatus {
  if (state && MAGENTO_ORDER_STATE_STATUS[state]) {
    return MAGENTO_ORDER_STATE_STATUS[state];
  }
  if (status) {
    const statusState = MAGENTO_STATUS_STATE[status] ?? status;
    if (MAGENTO_ORDER_STATE_STATUS[statusState]) {
      return MAGENTO_ORDER_STATE_STATUS[statusState];
    }
  }
  return 'AwaitingPayment';
}

/** The Magento order states that map onto any of `statuses`. */
export function magentoOrderStatesFor(statuses: readonly OrderStatus[]): string[] {
  return Object.entries(MAGENTO_ORDER_STATE_STATUS)
    .filter(([, status]) => statuses.includes(status))
    .map(([state]) => state);
}

const MAGENTO_DATE_TIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

/**
 * Magento writes timestamps as `YYYY-MM-DD HH:mm:ss` in UTC, without a zone,
 * which `Date` would read as local time. Returns an ISO 8601 string, the raw
 * value when it is not a date, and '' when Magento sent none: a missing date
 * is never replaced by the current time.
 */
export function parseMagentoDate(value?: string): string {
  if (!value) {
    return '';
  }
  const magentoDateTime = MAGENTO_DATE_TIME.exec(value);
  const normalized = magentoDateTime ? `${magentoDateTime[1]}T${magentoDateTime[2]}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** The order currency, or the request currency when Magento's code is not one core knows. */
export function resolveMagentoOrderCurrency(
  code: string | undefined,
  context: RequestContext,
): Currency {
  const parsed = CurrencySchema.safeParse((code ?? '').toUpperCase());
  return parsed.success ? parsed.data : context.languageContext.currencyCode;
}

/**
 * One customer-facing order line: a top-level Magento order item together
 * with its child rows (the selected simple product of a configurable, the
 * selections of a bundle).
 */
export interface MagentoOrderLine {
  item: MagentoOrderDetailItem;
  children: MagentoOrderDetailItem[];
}

/**
 * Groups child rows under their parent so configurable products are not
 * reported twice (once as the configurable, once as the simple).
 */
export function groupMagentoOrderLines(items: readonly MagentoOrderDetailItem[]): MagentoOrderLine[] {
  const ids = new Set(items.map((item) => item.item_id));
  const lines: MagentoOrderLine[] = [];
  const byId = new Map<number, MagentoOrderLine>();
  for (const item of items) {
    // A child whose parent is not in the payload is kept as a line of its own.
    if (item.parent_item_id === undefined || !ids.has(item.parent_item_id)) {
      const line: MagentoOrderLine = { item, children: [] };
      lines.push(line);
      byId.set(item.item_id, line);
    }
  }
  for (const item of items) {
    if (item.parent_item_id !== undefined) {
      byId.get(item.parent_item_id)?.children.push(item);
    }
  }
  return lines;
}

/** The quantity still to be shipped once cancellations are taken off. */
function outstandingQuantity(item: MagentoOrderDetailItem): number {
  return (item.qty_ordered ?? 0) - (item.qty_canceled ?? 0);
}

function isFullyShipped(item: MagentoOrderDetailItem): boolean | undefined {
  if (item.qty_ordered === undefined || item.qty_shipped === undefined) {
    return undefined;
  }
  const outstanding = outstandingQuantity(item);
  return outstanding > 0 && item.qty_shipped >= outstanding;
}

/**
 * A line is `Allocated` once its outstanding quantity has shipped. Shipment
 * is recorded on the parent row of a configurable and on the selections of a
 * bundle shipped separately, so either satisfies it. Without shipment
 * quantities the order state decides (`complete` means fully shipped).
 */
export function magentoLineInventoryStatus(
  line: MagentoOrderLine,
  state?: string,
): OrderInventoryStatus {
  const parentShipped = isFullyShipped(line.item);
  if (parentShipped) {
    return 'Allocated';
  }
  const childShipped = line.children.map(isFullyShipped);
  if (childShipped.length > 0 && childShipped.every((shipped) => shipped === true)) {
    return 'Allocated';
  }
  if (parentShipped === false || childShipped.some((shipped) => shipped === false)) {
    return 'NotAllocated';
  }
  return state === 'complete' ? 'Allocated' : 'NotAllocated';
}

/**
 * The order is `Allocated` when every line still to be delivered (fully
 * cancelled lines aside) has shipped; without lines the state decides.
 */
export function magentoOrderInventoryStatus(
  order: Pick<MagentoOrderDetail, 'items' | 'state'>,
): OrderInventoryStatus {
  const lines = groupMagentoOrderLines(order.items ?? []).filter(
    (line) => line.item.qty_ordered === undefined || outstandingQuantity(line.item) > 0,
  );
  if (lines.length === 0) {
    return order.state === 'complete' ? 'Allocated' : 'NotAllocated';
  }
  return lines.every((line) => magentoLineInventoryStatus(line, order.state) === 'Allocated')
    ? 'Allocated'
    : 'NotAllocated';
}

export function parseMagentoOrderAddress(
  address: MagentoOrderDetailAddress,
  fallbackNickName: string,
): Address {
  const street = address.street ?? [];
  return {
    identifier: AddressIdentifierSchema.parse({
      nickName: address.entity_id ? String(address.entity_id) : fallbackNickName,
    }),
    firstName: address.firstname || '',
    lastName: address.lastname || '',
    streetAddress: street[0] || '',
    streetNumber: street[1] || '',
    city: address.city || '',
    region: address.region || address.region_code || '',
    postalCode: address.postcode || '',
    countryCode: address.country_id || '',
  };
}

/** The shipping address of the order's first shipment assignment, if any. */
export function magentoOrderShippingAddress(
  order: Pick<MagentoOrderDetail, 'extension_attributes'>,
): MagentoOrderDetailAddress | undefined {
  return order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address;
}
