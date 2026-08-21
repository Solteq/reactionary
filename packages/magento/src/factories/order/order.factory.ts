import {
  AddressIdentifierSchema,
  type Address,
  type AnyOrderSchema,
  type CostBreakDown,
  type Currency,
  type IdentityIdentifier,
  type ItemCostBreakdown,
  type Order,
  type OrderFactory,
  type OrderInventoryStatus,
  type OrderItem,
  type OrderSchema,
  type PaymentInstruction,
  type PaymentStatus,
  type RequestContext,
  type ShippingMethod,
} from '@reactionary/core';
import type * as z from 'zod';
import { mapMagentoOrderStatus } from '../order-search/order-search.factory.js';

export interface MagentoOrderDetailAddress {
  firstname?: string;
  lastname?: string;
  street?: string[];
  city?: string;
  region?: string;
  postcode?: string;
  country_id?: string;
  telephone?: string;
  email?: string;
  entity_id?: number;
}

export interface MagentoOrderDetailItem {
  item_id: number;
  sku: string;
  name?: string;
  qty_ordered?: number;
  price?: number;
  row_total?: number;
}

export interface MagentoOrderDetailPayment {
  method?: string;
  amount_ordered?: number;
}

export interface MagentoOrderDetail {
  entity_id: number;
  increment_id?: string;
  customer_id?: number;
  customer_email?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  status?: string;
  state?: string;
  created_at?: string;
  order_currency_code?: string;
  grand_total?: number;
  subtotal?: number;
  shipping_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_description?: string;
  items?: MagentoOrderDetailItem[];
  billing_address?: MagentoOrderDetailAddress;
  payment?: MagentoOrderDetailPayment;
  extension_attributes?: {
    shipping_assignments?: Array<{
      shipping?: { address?: MagentoOrderDetailAddress; method?: string };
    }>;
  };
}

/**
 * Fields the confirmation-page use case needs that core's Order schema
 * doesn't declare (no date field at all, no contact info on Address). Order
 * schemas are z.looseObject-based, so these survive orderSchema.parse()
 * unchanged even though the base Order type doesn't know about them.
 */
export interface MagentoOrderOutput extends Order {
  orderDate: string;
  incrementId?: string;
  customerEmail?: string;
  customerPhone?: string;
}

function mapMagentoPaymentStatus(state?: string): PaymentStatus {
  switch (state) {
    case 'complete':
    case 'closed':
      return 'captured';
    case 'processing':
      return 'authorized';
    case 'canceled':
      return 'canceled';
    default:
      return 'pending';
  }
}

export class MagentoOrderFactory<
  TOrderSchema extends AnyOrderSchema = typeof OrderSchema,
> implements OrderFactory<TOrderSchema>
{
  public readonly orderSchema: TOrderSchema;

  constructor(orderSchema: TOrderSchema) {
    this.orderSchema = orderSchema;
  }

  protected parseAddress(address?: MagentoOrderDetailAddress): Address | undefined {
    if (!address) return undefined;
    const street = address.street ?? [];
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: address.entity_id ? String(address.entity_id) : 'address',
      }),
      firstName: address.firstname || '',
      lastName: address.lastname || '',
      streetAddress: street[0] || '',
      streetNumber: street[1] || '',
      city: address.city || '',
      region: address.region || '',
      postalCode: address.postcode || '',
      countryCode: address.country_id || '',
    };
  }

  protected parseOrderItem(
    order: MagentoOrderDetail,
    item: MagentoOrderDetailItem,
    currency: Currency,
  ): OrderItem {
    const unitPrice = item.price ?? 0;
    const totalPrice = item.row_total ?? unitPrice * (item.qty_ordered ?? 1);
    const price: ItemCostBreakdown = {
      unitPrice: { value: unitPrice, currency },
      totalPrice: { value: totalPrice, currency },
      unitDiscount: { value: 0, currency },
      totalDiscount: { value: 0, currency },
    };

    return {
      identifier: { key: String(item.item_id) },
      variant: { sku: item.sku },
      quantity: item.qty_ordered ?? 0,
      price,
      inventoryStatus: order.state === 'complete' ? 'Allocated' : 'NotAllocated',
    } satisfies OrderItem;
  }

  protected parseCostBreakdown(order: MagentoOrderDetail, currency: Currency): CostBreakDown {
    return {
      grandTotal: { value: order.grand_total ?? 0, currency },
      totalProductPrice: { value: order.subtotal ?? 0, currency },
      totalShipping: { value: order.shipping_amount ?? 0, currency },
      totalTax: { value: order.tax_amount ?? 0, currency },
      totalDiscount: { value: Math.abs(order.discount_amount ?? 0), currency },
      totalSurcharge: { value: 0, currency },
    };
  }

  protected parsePaymentInstruction(order: MagentoOrderDetail, currency: Currency): PaymentInstruction {
    const method = order.payment?.method ?? 'unknown';
    return {
      identifier: { key: String(order.entity_id) },
      amount: { value: order.payment?.amount_ordered ?? order.grand_total ?? 0, currency },
      paymentMethod: { method, name: method, paymentProcessor: method },
      protocolData: [],
      status: mapMagentoPaymentStatus(order.state),
    } satisfies PaymentInstruction;
  }

  protected parseShippingMethod(
    order: MagentoOrderDetail,
    method: string | undefined,
    currency: Currency,
  ): ShippingMethod | undefined {
    if (!method && !order.shipping_description) return undefined;
    return {
      identifier: { key: method ?? 'default' },
      name: order.shipping_description ?? method ?? '',
      description: order.shipping_description ?? '',
      price: { value: order.shipping_amount ?? 0, currency },
      deliveryTime: '',
    } satisfies ShippingMethod;
  }

  public parseOrder(_context: RequestContext, data: unknown): z.output<TOrderSchema> {
    const order = data as MagentoOrderDetail;
    const currency = (order.order_currency_code || 'USD').toUpperCase() as Currency;
    const orderStatus = mapMagentoOrderStatus(order.status);
    const inventoryStatus: OrderInventoryStatus = order.state === 'complete' ? 'Allocated' : 'NotAllocated';
    const userId: IdentityIdentifier = { userId: order.customer_id ? String(order.customer_id) : '' };
    const shippingAssignment = order.extension_attributes?.shipping_assignments?.[0]?.shipping;

    const result = {
      identifier: { key: String(order.entity_id) },
      userId,
      items: (order.items ?? []).map((item) => this.parseOrderItem(order, item, currency)),
      price: this.parseCostBreakdown(order, currency),
      orderStatus,
      inventoryStatus,
      paymentInstructions: order.payment ? [this.parsePaymentInstruction(order, currency)] : [],
      shippingAddress: this.parseAddress(shippingAssignment?.address ?? order.billing_address),
      billingAddress: this.parseAddress(order.billing_address),
      shippingMethod: this.parseShippingMethod(order, shippingAssignment?.method, currency),
      orderDate: new Date(order.created_at || Date.now()).toISOString(),
      incrementId: order.increment_id,
      customerEmail: order.customer_email || order.billing_address?.email,
      customerPhone: order.billing_address?.telephone,
    } satisfies MagentoOrderOutput;

    return this.orderSchema.parse(result);
  }
}
