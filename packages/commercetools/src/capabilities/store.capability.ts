import type {
  RequestContext,
  Cache,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StoreQueryByProximity,
  Result,
} from '@reactionary/core';
import { Reactionary, StoreCapability, StoreQueryByProximitySchema, StoreSchema, success, error } from '@reactionary/core';
import * as z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsStoreFactory } from '../factories/store/store.factory.js';

export class CommercetoolsStoreCapability<
  TFactory extends StoreFactory = CommercetoolsStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: StoreFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: StoreFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity
  ): Promise<Result<Array<StoreFactoryOutput<TFactory>>>> {
    const client = await this.getClient();

    const remote = await client
      .channels()
      .get({
        queryArgs: {
          limit: payload.limit,
          where: `geoLocation within circle(${payload.longitude}, ${
            payload.latitude
          }, ${
            payload.distance * 1000
          }) AND roles contains any ("InventorySupply")`,
        },
      })
      .execute();

    const results = [];

    for (const r of remote.body.results) {
      results.push(this.factory.parseStore(this.context, r));
    }

    return success(results);
  }

}
