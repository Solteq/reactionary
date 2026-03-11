import type {
  Cache,
  NotFoundError,
  OrderFactory,
  OrderFactoryOutput,
  OrderFactoryWithOutput,
  OrderQueryById,
  RequestContext,
  Result
} from '@reactionary/core';
import {
  OrderCapability,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  success
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaOrderFactory } from '../factories/order/order.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';
const debug = createDebug('reactionary:medusa:order');

export class MedusaOrderCapability<
  TFactory extends OrderFactory = MedusaOrderFactory,
> extends OrderCapability<OrderFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
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
    debug('getById', payload);

    const medusa = await this.medusaApi.getClient();

    try {
      // TODO: Implement actual order retrieval logic
      // const response = await medusa.store.order.retrieve(payload.order.key);
      const response = await  medusa.store.order.retrieve(payload.order.key)

      const order = this.factory.parseOrder(this.context, response.order);

      return success(order);

    } catch (err) {
      return handleProviderError('order', err);
    }
  }


}
