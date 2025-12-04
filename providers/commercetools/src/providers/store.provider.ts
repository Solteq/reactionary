import type {
  RequestContext,
  Cache,
  StoreQueryByProximity,
  Store,
  StoreIdentifier,
  FulfillmentCenterIdentifier,
  Meta,
  Result,
} from '@reactionary/core';
import { Reactionary, StoreProvider, StoreQueryByProximitySchema, StoreSchema, success, error } from '@reactionary/core';
import z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Channel } from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsStoreProvider extends StoreProvider {
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
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity
  ): Promise<Result<Array<Store>>> {
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
      results.push(this.parseSingle(r));
    }

    return success(results);
  }

  protected parseSingle(body: Channel): Store {

    let name = '';
    if (body.name && body.name['la']) {
      name = body.name['la'];
    }

    const identifier = {
      key: body.key,
    } satisfies StoreIdentifier;

    const fulfillmentCenter = {
      key: body.key,
    } satisfies FulfillmentCenterIdentifier;

    const meta = {
      cache: {
        hit: false,
        key: ''
      },
      placeholder: false
    } satisfies Meta;

    const result = {
      identifier,
      fulfillmentCenter,
      name,
      meta,
    } satisfies Store;

    return result;
  }
}
