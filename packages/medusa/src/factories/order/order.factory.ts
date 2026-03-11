import type { StoreOrder, StoreOrderLineItem, StorePaymentCollection } from '@medusajs/types';
import {
  ProductVariantIdentifierSchema,
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
  type OrderStatus,
  type PaymentInstruction,
  type PaymentMethodIdentifier,
  type ProductVariantIdentifier,
  type RequestContext
} from '@reactionary/core';
import type * as z from 'zod';
import { parseMedusaCostBreakdown, parseMedusaItemPrice } from '../../utils/medusa-helpers.js';

export class MedusaOrderFactory<
  TOrderSchema extends AnyOrderSchema = typeof OrderSchema,
> implements OrderFactory<TOrderSchema>
{
  public readonly orderSchema: TOrderSchema;

  constructor(orderSchema: TOrderSchema) {
    this.orderSchema = orderSchema;
  }

  public parseOrder(context: RequestContext, data: StoreOrder): z.output<TOrderSchema> {
    const identifier = { key: data.id };
    const userId: IdentityIdentifier = {
      userId: data.customer_id || '',
    }

    const items = (data.items || []).map((item) => {
      return this.parseOrderItem(context,item, data.currency_code.toUpperCase() as Currency);
    });

    const price = this.parseCostBreakdown(context, data);

    let orderStatus: OrderStatus = 'AwaitingPayment'
    if (data.status === 'draft') {
      orderStatus = 'AwaitingPayment';
    }
    if (data.status === 'pending') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (data.status === 'completed') {
      orderStatus = 'Shipped';
    }
    if (data.status === 'canceled') {
      orderStatus = 'Cancelled';
    }

    let inventoryStatus: OrderInventoryStatus = 'NotAllocated'
    // Medusa does not have direct mapping for inventory status on orders
    // This is a placeholder logic and may need to be adjusted based on actual requirements
    if(data.fulfillment_status === "fulfilled") {
      inventoryStatus = 'Allocated';
    }

    const paymentInstructions: PaymentInstruction[] =  data.payment_collections?.map( (pc) => {
      return this.parsePaymentInstruction(context, pc, data);
    }) || [];

    const result = {
      identifier,
      userId,
      items,
      price,
      orderStatus,
      inventoryStatus,
      paymentInstructions
    } satisfies Order;

    return this.orderSchema.parse(result);

  }



  /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
    context: RequestContext,
    remoteItem: StoreOrderLineItem,
    currency: Currency
  ): ItemCostBreakdown {
    return parseMedusaItemPrice(remoteItem, currency);
  }

  /**
   * Extension point to control the parsing of the cost breakdown of a cart
   * @param remote
   * @returns
   */
  protected parseCostBreakdown(_context: RequestContext, remote: StoreOrder): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }

  /**
   * Extension point to control the parsing of a single cart item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseOrderItem(
    context: RequestContext,
    remoteItem: StoreOrderLineItem,
    currency: Currency
  ): OrderItem {
    const item: OrderItem = {
      identifier: {
        key: remoteItem.id,
      },
      variant: ProductVariantIdentifierSchema.parse({
        sku: remoteItem.variant_sku || '',
      } satisfies ProductVariantIdentifier),
      quantity: remoteItem.quantity || 1,
      price: this.parseItemPrice(context, remoteItem, currency),
      inventoryStatus: 'Allocated'
    };
    return item;
  }

  protected parsePaymentInstruction(_context: RequestContext, remotePayment: StorePaymentCollection, order: StoreOrder) {
      const paymentMethodIdentifier: PaymentMethodIdentifier = {
        method: remotePayment.payment_providers?.[0]?.id || 'unknown',
        name: remotePayment.payment_providers?.[0]?.id || 'unknown',
        paymentProcessor: remotePayment.payment_providers?.[0]?.id || 'unknown',
      };

      let status: PaymentInstruction['status'] = 'pending';
      switch (remotePayment.status) {
        case 'not_paid':
          status = 'pending';
          break;
        case 'awaiting':
          status = 'pending';
          break;
        case 'authorized':
          status = 'authorized';
          break;
        case 'partially_authorized':
          status = 'pending';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'failed':
          status = 'canceled';
          break;
        case 'completed':
          status = 'capture';
          break;
      }

      const paymentData = remotePayment.payments?.[0].data || {};
      const pi = {
        identifier: {
          key: remotePayment.id,
        },
        amount: {
          value: remotePayment.amount,
          currency: remotePayment.currency_code?.toUpperCase() as Currency,
        },
        paymentMethod: paymentMethodIdentifier,
        protocolData: paymentData
          ? Object.entries(paymentData).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          : [],
        status,
      } satisfies PaymentInstruction;
    return pi;
  }

}
