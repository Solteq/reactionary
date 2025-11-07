import type {
  RequestContext,
  Cache,
  Order,
  OrderQueryById,
  Currency,
} from '@reactionary/core';
import { OrderItemSchema, OrderProvider } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { CommercetoolsClient } from '../core/client.js';
import type { ApiRoot, Order as CTOrder } from '@commercetools/platform-sdk';
import { CommercetoolsOrderIdentifierSchema } from '../schema/commercetools.schema.js';
export class CommercetoolsOrderProvider<
  T extends Order = Order
> extends OrderProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: Promise<ApiRoot>;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: Promise<ApiRoot>
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client;
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .orders();
  }

  public override async getById(payload: OrderQueryById): Promise<T> {
    const client = await this.client;

    try {
      const remote = await client
        .withProjectKey({ projectKey: this.config.projectKey })
        .orders()
        .withId({ ID: payload.order.key })
        .get()
        .execute();

      return this.parseSingle(remote.body);
    } catch (e) {
      return this.createEmptyOrder();
    }
  }

  protected override parseSingle(_body: unknown): T {
    const remote = _body as CTOrder;
    const result = this.newModel();

    result.identifier = CommercetoolsOrderIdentifierSchema.parse({
      key: remote.id,
      version: remote.version || 0,
    });

    result.name = remote.custom?.fields['name'] || '';
    result.description = remote.custom?.fields['description'] || '';

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

    result.price = {
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
    };

    if (remote.paymentState === 'Pending' && remote.orderState === 'Open') {
      result.orderStatus = 'AwaitingPayment';
    } else if (
      remote.paymentState === 'Paid' &&
      remote.orderState === 'Confirmed'
    ) {
      result.orderStatus = 'ReleasedToFulfillment';
    }
    if (remote.shipmentState === 'Ready' && remote.orderState === 'Confirmed') {
      result.orderStatus = 'ReleasedToFulfillment';
    }
    if (
      (remote.shipmentState === 'Shipped' ||
        remote.shipmentState === 'Delivered') &&
      remote.orderState === 'Completed'
    ) {
      result.orderStatus = 'Shipped';
    }

    for (const remoteItem of remote.lineItems) {
      const item = OrderItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.variant.sku = remoteItem.variant.sku || '';
      item.quantity = remoteItem.quantity;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;

      item.price = {
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
      };

      result.items.push(item);
    }

    result.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(result.identifier),
      },
      placeholder: false,
    };

    return this.assert(result);
  }
}
