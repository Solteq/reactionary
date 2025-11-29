import type {
  RequestContext,
  Cache,
  Order,
  OrderQueryById,
  Currency,
  OrderIdentifier,
  CostBreakDown,
  Meta,
  OrderStatus,
  OrderItem,
  ProductVariantIdentifier,
  ItemCostBreakdown,
} from '@reactionary/core';
import { OrderItemSchema, OrderProvider, OrderQueryByIdSchema, OrderSchema, Reactionary } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Order as CTOrder } from '@commercetools/platform-sdk';
import { CommercetoolsOrderIdentifierSchema, type CommercetoolsOrderIdentifier } from '../schema/commercetools.schema.js';
import type { CommercetoolsClient } from '../core/client.js';
export class CommercetoolsOrderProvider extends OrderProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .orders();
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public override async getById(payload: OrderQueryById): Promise<Order> {
    const client = await this.getClient();

    try {
      const remote = await client
        .withId({ ID: payload.order.key })
        .get()
        .execute();

      return this.parseSingle(remote.body);
    } catch (e) {
      return this.createEmptyOrder();
    }
  }

  protected parseSingle(_body: unknown): Order {
    const remote = _body as CTOrder;

    const identifier = {
      key: remote.id,
      version: remote.version || 0,
    } satisfies CommercetoolsOrderIdentifier;

    const name = remote.custom?.fields['name'] || '';
    const description = remote.custom?.fields['description'] || '';

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

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
        currency: remote.shippingInfo?.price.currencyCode as Currency,
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
    if (remote.paymentState === 'Pending' && remote.orderState === 'Open') {
      orderStatus = 'AwaitingPayment';
    } else if (
      remote.paymentState === 'Paid' &&
      remote.orderState === 'Confirmed'
    ) {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (remote.shipmentState === 'Ready' && remote.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (
      (remote.shipmentState === 'Shipped' ||
        remote.shipmentState === 'Delivered') &&
      remote.orderState === 'Completed'
    ) {
      orderStatus = 'Shipped';
    }

    const items = new Array<OrderItem>();
    for (const remoteItem of remote.lineItems) {
      const identifier = {
        key: remoteItem.id
      } satisfies OrderIdentifier;

      const variant = {
        sku: remoteItem.variant.sku || ''
      } satisfies ProductVariantIdentifier;
      const quantity = remoteItem.quantity;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;

      const price = {
        unitPrice: {
          value: unitPrice / 100,
          currency,
        },
        unitDiscount: {
          value: unitDiscount / 100,
          currency,
        },
        totalPrice: {
          value: (totalPrice || 0) / 100,
          currency,
        },
        totalDiscount: {
          value: totalDiscount / 100,
          currency,
        },
      } satisfies ItemCostBreakdown;

      const item = {
        identifier,
        inventoryStatus: 'NotAllocated',
        price,
        quantity,
        variant
      } satisfies OrderItem;

      items.push(item);
    }

    const meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(identifier),
      },
      placeholder: false,
    } satisfies Meta;

    const result = {
      identifier,
      name,
      description,
      price,
      items,
      inventoryStatus: 'NotAllocated',
      paymentInstructions: [],
      userId: {
        userId: ''
      },
      meta,
      orderStatus
    } satisfies Order;

    return result;
  }
}
