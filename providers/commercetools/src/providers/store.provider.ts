import type {
  RequestContext,
  Cache,
  StoreQueryByProximity,
} from '@reactionary/core';
import { StoreProvider } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ApiRoot, Channel } from '@commercetools/platform-sdk';
import type { Store } from '@reactionary/core';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsStoreProvider<
  T extends Store = Store
> extends StoreProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey });
  }

  public override async queryByProximity(
    payload: StoreQueryByProximity
  ): Promise<Array<T>> {
    const client = await this.getClient();

    const remote = await client
        .channels()
        .get({
            queryArgs: {
                limit: payload.limit,
                where: `geoLocation within circle(${ payload.longitude }, ${ payload.latitude }, ${payload.distance * 1000}) AND roles contains any ("InventorySupply")`
            }
        }).execute();

    const results = [];

    for (const r of remote.body.results) {
        results.push(this.parseSingle(r));
    }

    return results;
  }

  protected override parseSingle(
    body: Channel
  ): T {
    const model = this.newModel();

    if (body.name && body.name['la']) {
        model.name = body.name['la'];
    }

    model.identifier = {
        key: body.key
    };

    model.fulfillmentCenter = {
        key: body.key
    };

    return model;
  }
}
