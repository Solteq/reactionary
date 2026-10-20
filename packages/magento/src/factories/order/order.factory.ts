import type {
  Address,
  AnyOrderSchema,
  CartIdentifier,
  CompanyIdentifier,
  CostBreakDown,
  Currency,
  IdentityIdentifier,
  ItemCostBreakdown,
  Order,
  OrderFactory,
  OrderItem,
  OrderSchema,
  PaymentInstruction,
  PaymentStatus,
  RequestContext,
  ShippingMethod,
} from '@reactionary/core';
import type * as z from 'zod';
import { encodeMagentoUid } from '../../core/company.api.js';
import {
  MagentoOrderDetailSchema,
  type MagentoOrderDetail,
  type MagentoOrderDetailAddress,
  type MagentoOrderDetailItem,
} from '../../schema/order.types.js';
import {
  groupMagentoOrderLines,
  magentoLineInventoryStatus,
  magentoOrderInventoryStatus,
  magentoOrderShippingAddress,
  mapMagentoOrderStatus,
  parseMagentoDate,
  parseMagentoOrderAddress,
  resolveMagentoOrderCurrency,
} from './order-mapping.js';
import { toMagentoCompanyIdentifier } from '../company/company.factory.js';

export type {
  MagentoOrderCompanyAttributes,
  MagentoOrderDetail,
  MagentoOrderDetailAddress,
  MagentoOrderDetailItem,
  MagentoOrderDetailPayment,
} from '../../schema/order.types.js';

/**
 * Fields the confirmation-page use case needs that core's Order schema
 * doesn't declare (no date field at all, no contact info on Address). Order
 * schemas are z.looseObject-based, so these survive orderSchema.parse()
 * unchanged even though the base Order type doesn't know about them.
 *
 * `orderDate` is ISO 8601, or '' when Magento sent no `created_at`.
 */
export interface MagentoOrderOutput extends Order {
  orderDate: string;
  incrementId?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Derives the payment status from the amounts Magento tracks on the payment,
 * falling back to the order state when the payload carries none of them.
 */
function mapMagentoPaymentStatus(order: MagentoOrderDetail): PaymentStatus {
  if (order.state === 'canceled') {
    return 'canceled';
  }
  const payment = order.payment;
  const paid = payment?.amount_paid ?? 0;
  const refunded = payment?.amount_refunded ?? 0;
  const ordered = payment?.amount_ordered ?? order.grand_total ?? 0;
  if (refunded > 0) {
    return refunded >= paid ? 'refunded' : 'partial_refunded';
  }
  if (paid > 0) {
    return paid >= ordered ? 'captured' : 'partial_captured';
  }
  if ((payment?.amount_authorized ?? 0) > 0) {
    return 'authorized';
  }
  switch (order.state) {
    case 'closed':
      return 'refunded';
    case 'complete':
      return 'captured';
    case 'processing':
      return 'authorized';
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
    return address ? parseMagentoOrderAddress(address, 'address') : undefined;
  }

  /**
   * Maps one order line. `children` are the line's child rows: for a
   * configurable the selected simple, whose sku identifies the variant, while
   * Magento keeps the price, discount and shipped quantity on the parent.
   */
  protected parseOrderItem(
    order: MagentoOrderDetail,
    item: MagentoOrderDetailItem,
    currency: Currency,
    children: MagentoOrderDetailItem[] = [],
  ): OrderItem {
    const quantity = item.qty_ordered ?? 0;
    const unitPrice = item.price ?? 0;
    const totalPrice = item.row_total ?? unitPrice * quantity;
    const totalDiscount = Math.abs(item.discount_amount ?? 0);
    const price: ItemCostBreakdown = {
      unitPrice: { value: unitPrice, currency },
      totalPrice: { value: totalPrice, currency },
      unitDiscount: { value: quantity > 0 ? totalDiscount / quantity : 0, currency },
      totalDiscount: { value: totalDiscount, currency },
    };

    const variantSku =
      item.product_type === 'configurable' && children.length > 0 ? children[0].sku : item.sku;

    return {
      identifier: { key: String(item.item_id) },
      variant: { sku: variantSku },
      quantity,
      price,
      inventoryStatus: magentoLineInventoryStatus({ item, children }, order.state),
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
      status: mapMagentoPaymentStatus(order),
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

  /**
   * The ordering company of an Adobe Commerce B2B order, identified the way
   * the company capability identifies it: by its VAT id when known (see
   * `MagentoOrderCompanyAttributes.vat_tax_id`), else by its uid.
   */
  protected parseCompany(order: MagentoOrderDetail): CompanyIdentifier | undefined {
    const attributes = order.extension_attributes?.company_order_attributes;
    if (!attributes?.company_id) {
      return undefined;
    }
    return toMagentoCompanyIdentifier({
      id: encodeMagentoUid(String(attributes.company_id)),
      vat_tax_id: attributes.vat_tax_id,
    });
  }

  /**
   * The quote the order was placed from. Only customer orders are linked:
   * a customer cart is keyed by its quote id, whereas a guest cart is keyed
   * by a masked id the order does not carry.
   */
  protected parseCartReference(order: MagentoOrderDetail): CartIdentifier | undefined {
    if (order.quote_id === undefined || order.customer_is_guest === 1 || !order.customer_id) {
      return undefined;
    }
    return { key: String(order.quote_id) };
  }

  public parseOrder(context: RequestContext, data: unknown): z.output<TOrderSchema> {
    const order = MagentoOrderDetailSchema.parse(data);
    const currency = resolveMagentoOrderCurrency(order.order_currency_code, context);
    const userId: IdentityIdentifier = { userId: order.customer_id ? String(order.customer_id) : '' };
    const shipping = order.extension_attributes?.shipping_assignments?.[0]?.shipping;
    const lines = groupMagentoOrderLines(order.items ?? []);

    const result = {
      identifier: { key: String(order.entity_id) },
      userId,
      company: this.parseCompany(order),
      name: order.increment_id,
      description: order.customer_note || undefined,
      items: lines.map((line) => this.parseOrderItem(order, line.item, currency, line.children)),
      price: this.parseCostBreakdown(order, currency),
      orderStatus: mapMagentoOrderStatus(order.status, order.state),
      inventoryStatus: magentoOrderInventoryStatus(order),
      paymentInstructions: order.payment ? [this.parsePaymentInstruction(order, currency)] : [],
      // Virtual orders have no shipment assignment, hence no shipping address.
      shippingAddress: this.parseAddress(magentoOrderShippingAddress(order)),
      billingAddress: this.parseAddress(order.billing_address),
      shippingMethod: this.parseShippingMethod(order, shipping?.method, currency),
      cartReference: this.parseCartReference(order),
      orderDate: parseMagentoDate(order.created_at),
      incrementId: order.increment_id,
      customerEmail: order.customer_email || order.billing_address?.email,
      customerPhone: order.billing_address?.telephone,
    } satisfies MagentoOrderOutput;

    return this.orderSchema.parse(result);
  }
}
