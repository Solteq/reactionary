import type {
  RequestContext,
  Cache,
  OrderFactory,
  OrderFactoryOutput,
  OrderFactoryWithOutput,
  OrderQueryById,
  Result,
  NotFoundError,
} from '@reactionary/core';
import { OrderCapability, OrderQueryByIdSchema, OrderSchema, Reactionary, success, error } from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsOrderFactory } from '../factories/order/order.factory.js';

export class CommercetoolsOrderCapability<
  TFactory extends OrderFactory = CommercetoolsOrderFactory,
> extends OrderCapability<OrderFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: OrderFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .orders();
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public override async getById(payload: OrderQueryById): Promise<Result<OrderFactoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();

    try {
      const remote = await client
        .withId({ ID: payload.order.key })
        .get()
        .execute();

      return success(this.factory.parseOrder(this.context, remote.body));
    } catch (e) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      })
    }
  }

}
