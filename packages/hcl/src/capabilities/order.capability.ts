import {
  type Cache,
  type NotFoundError,
  OrderCapability,
  type OrderFactory,
  type OrderFactoryOutput,
  type OrderFactoryWithOutput,
  type OrderQueryById,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclOrderFactory } from '../factories/order/order.factory.js';
import type { HclWcsOrderDetailResponse } from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:order');

export class HclOrderCapability<
  TFactory extends OrderFactory = HclOrderFactory,
> extends OrderCapability<OrderFactoryOutput<TFactory>> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: OrderFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public async getById(
    payload: OrderQueryById,
  ): Promise<Result<OrderFactoryOutput<TFactory>, NotFoundError>> {
    debug('getById %s', payload.order.key);
    const data = await this.client.callGet<HclWcsOrderDetailResponse>(
      this.orderUrl(payload.order.key),
      this.orderParams(),
      { allowUndefined: true },
    );
    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.order,
      });
    }
    return success(this.factory.parseOrder(this.context, data));
  }

  protected orderUrl(orderId: string): string {
    return `${this.client.transactionBaseUrl}/order/${encodeURIComponent(orderId)}`;
  }

  protected orderParams(): URLSearchParams {
    return new URLSearchParams({ profileName: 'IBM_getOrderDetailsByOrderId' });
  }
}
