import type {
  Cache,
  Order,
  OrderQueryById,
  RequestContext,
  Result,
  NotFoundError,
  IdentityIdentifier,
  CostBreakDown,
  Currency,
  OrderItem,
  CartItem,
  ProductVariantIdentifier,
  ItemCostBreakdown,
  OrderStatus,
  InventoryStatus,
  OrderInventoryStatus,
  PaymentMethodIdentifier,
  PaymentInstruction,
} from '@reactionary/core';
import {
  OrderProvider,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  success,
  error,
  ProductVariantIdentifierSchema,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';
import type { StoreOrder, StoreOrderLineItem, StorePaymentCollection } from '@medusajs/types';
import { parseMedusaItemPrice, parseMedusaCostBreakdown } from '../utils/medusa-helpers.js'
const debug = createDebug('reactionary:medusa:order');

export class MedusaOrderProvider extends OrderProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI
  ) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public async getById(payload: OrderQueryById): Promise<Result<Order, NotFoundError>> {
    debug('getById', payload);

    const medusa = await this.medusaApi.getClient();

    try {
      // TODO: Implement actual order retrieval logic
      // const response = await medusa.store.order.retrieve(payload.order.key);
      const response = await  medusa.store.order.retrieve(payload.order.key)

      const order = this.parseSingle(response.order);

      return success(order);

    } catch (err) {
      return handleProviderError('order', err);
    }
  }


  /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
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
  protected parseCostBreakdown(remote: StoreOrder): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }

  /**
   * Extension point to control the parsing of a single cart item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseOrderItem(
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
      price: this.parseItemPrice(remoteItem, currency),
      inventoryStatus: 'Allocated'
    };
    return item;
  }

  protected parsePaymentInstruction(remotePayment: StorePaymentCollection, order: StoreOrder) {
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




  protected parseSingle(body: StoreOrder): Order {

    const identifier = { key: body.id };
    const userId: IdentityIdentifier = {
      userId: body.customer_id || '',
    }

    const items = (body.items || []).map((item) => {
      return this.parseOrderItem(item, body.currency_code.toUpperCase() as Currency);
    });

    const price = this.parseCostBreakdown(body);

    let orderStatus: OrderStatus = 'AwaitingPayment'
    if (body.status === 'draft') {
      orderStatus = 'AwaitingPayment';
    }
    if (body.status === 'pending') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (body.status === 'completed') {
      orderStatus = 'Shipped';
    }
    if (body.status === 'canceled') {
      orderStatus = 'Cancelled';
    }

    let inventoryStatus: OrderInventoryStatus = 'NotAllocated'
    // Medusa does not have direct mapping for inventory status on orders
    // This is a placeholder logic and may need to be adjusted based on actual requirements
    if(body.fulfillment_status === "fulfilled") {
      inventoryStatus = 'Allocated';
    }

    const paymentInstructions: PaymentInstruction[] =  body.payment_collections?.map( (pc) => {
      return this.parsePaymentInstruction(pc, body);
    }) || [];

    return {
      identifier,
      userId,
      items,
      price,
      orderStatus,
      inventoryStatus,
      paymentInstructions
    } satisfies Order;
  }
}
