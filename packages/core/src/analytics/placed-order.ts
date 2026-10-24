import type { Checkout } from '../schemas/models/checkout.model.js';
import type { CostBreakDown, ItemCostBreakdown } from '../schemas/models/cost.model.js';
import type { ProductVariantIdentifier } from '../schemas/models/identifiers.model.js';
import type { Order } from '../schemas/models/order.model.js';

export interface PlacedOrderLine {
  variant: ProductVariantIdentifier;
  quantity: number;
  price: ItemCostBreakdown;
}

/** What an analytics subscriber needs to report a purchase, whether it was given a checkout or an order. */
export interface PlacedOrderSummary {
  /** The order key when it is known, otherwise the key of the checkout that created it. */
  transactionId: string;
  items: PlacedOrderLine[];
  price: CostBreakDown;
}

/**
 * Normalizes an order-placed payload. The checkout is preferred, as it is what the customer placed; the order is
 * the deprecated alternative. Returns undefined when the payload carries neither.
 */
export function summarizePlacedOrder(payload: { checkout?: Checkout; order?: Order }): PlacedOrderSummary | undefined {
  const { checkout, order } = payload;
  const source = checkout ?? order;
  if (!source) {
    return undefined;
  }

  return {
    transactionId: order?.identifier.key ?? checkout?.resultingOrder?.key ?? source.identifier.key,
    items: source.items,
    price: source.price,
  };
}
