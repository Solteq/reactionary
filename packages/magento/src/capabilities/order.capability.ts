import type {
  Cache,
  NotFoundError,
  OrderFactory,
  OrderFactoryOutput,
  OrderFactoryWithOutput,
  OrderQueryById,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  OrderCapability,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoOrderFactory } from '../factories/order/order.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:magento:order');

export class MagentoOrderCapability<
  TFactory extends OrderFactory = MagentoOrderFactory,
> extends OrderCapability<OrderFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: OrderFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
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
    const data = await this.magentoApi.getOrderById(payload.order.key);
    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.order,
      });
    }
    return success(this.factory.parseOrder(this.context, data));
  }
}
