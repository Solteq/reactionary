import type { Order as CTOrder } from '@commercetools/platform-sdk';
import {
  OrderSchema,
  type AnyOrderSchema,
  type CostBreakDown,
  type Currency,
  type ItemCostBreakdown,
  type Order,
  type OrderFactory,
  type OrderIdentifier,
  type OrderItem,
  type OrderStatus,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { CommercetoolsOrderIdentifier } from '../../schema/commercetools.schema.js';

export class CommercetoolsOrderFactory<
  TOrderSchema extends AnyOrderSchema = typeof OrderSchema,
> implements OrderFactory<TOrderSchema>
{
  public readonly orderSchema: TOrderSchema;

  constructor(orderSchema: TOrderSchema) {
    this.orderSchema = orderSchema;
  }

  public parseOrder(
    _context: RequestContext,
    data: CTOrder,
  ): z.output<TOrderSchema> {
    const identifier = {
      key: data.id,
      version: data.version || 0,
    } satisfies CommercetoolsOrderIdentifier;

    const name = data.custom?.fields['name'] || '';
    const description = data.custom?.fields['description'] || '';

    const grandTotal = data.totalPrice.centAmount || 0;
    const shippingTotal = data.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = data.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal = data.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = data.totalPrice.currencyCode as Currency;

    const price = {
      totalTax: {
        value: taxTotal / 100,
        currency,
      },
      totalDiscount: {
        value: discountTotal / 100,
        currency,
      },
      totalSurcharge: {
        value: surchargeTotal / 100,
        currency,
      },
      totalShipping: {
        value: shippingTotal / 100,
        currency: data.shippingInfo?.price.currencyCode as Currency,
      },
      totalProductPrice: {
        value: productTotal / 100,
        currency,
      },
      grandTotal: {
        value: grandTotal / 100,
        currency,
      },
    } satisfies CostBreakDown;

    let orderStatus: OrderStatus = 'AwaitingPayment';
    if (data.paymentState === 'Paid' && data.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (data.shipmentState === 'Ready' && data.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (
      (data.shipmentState === 'Shipped' || data.shipmentState === 'Delivered') &&
      data.orderState === 'Completed'
    ) {
      orderStatus = 'Shipped';
    }

    const items: OrderItem[] = [];
    for (const remoteItem of data.lineItems) {
      const lineIdentifier = {
        key: remoteItem.id,
      } satisfies OrderIdentifier;
      const variant = {
        sku: remoteItem.variant.sku || '',
      } satisfies ProductVariantIdentifier;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;

      const linePrice = {
        unitPrice: {
          value: unitPrice / 100,
          currency,
        },
        unitDiscount: {
          value: unitDiscount / 100,
          currency,
        },
        totalPrice: {
          value: totalPrice / 100,
          currency,
        },
        totalDiscount: {
          value: totalDiscount / 100,
          currency,
        },
      } satisfies ItemCostBreakdown;

      items.push({
        identifier: lineIdentifier,
        inventoryStatus: 'NotAllocated',
        price: linePrice,
        quantity: remoteItem.quantity,
        variant,
      } satisfies OrderItem);
    }

    const result = {
      identifier,
      name,
      description,
      price,
      items,
      inventoryStatus: 'NotAllocated',
      paymentInstructions: [],
      userId: {
        userId: '',
      },
      orderStatus,
    } satisfies Order;

    return this.orderSchema.parse(result);
  }
}
