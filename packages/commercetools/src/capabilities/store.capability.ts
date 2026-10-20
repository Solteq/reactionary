import type {
  RequestContext,
  Cache,
  NotFoundError,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StorePaginatedResult,
  StoreQueryById,
  StoreQueryByProximity,
  StoreQueryForList,
  Result,
} from '@reactionary/core';
import {
  Reactionary,
  StoreCapability,
  StorePaginatedResultSchema,
  StoreQueryByIdSchema,
  StoreQueryByProximitySchema,
  StoreQueryForListSchema,
  StoreSchema,
  success,
  error,
} from '@reactionary/core';
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

  /**
   * The channel predicate selecting the channels that represent the brand's
   * own stores. Override in a subclass if a project models stores differently.
   */
  protected getStoreChannelPredicate(): string {
    return 'roles contains any ("InventorySupply")';
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    const client = await this.getClient();

    const { pageNumber, pageSize } = payload.paginationOptions;

    const remote = await client
      .channels()
      .get({
        queryArgs: {
          limit: pageSize,
          offset: (pageNumber - 1) * pageSize,
          withTotal: true,
          where: this.getStoreChannelPredicate(),
        },
      })
      .execute();

    const totalCount = remote.body.total ?? remote.body.results.length;

    return success({
      pageNumber,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      items: remote.body.results.map((r) => this.factory.parseStore(this.context, r)),
    });
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client
      .channels()
      .get({
        queryArgs: {
          limit: 1,
          where: `key = :key AND ${this.getStoreChannelPredicate()}`,
          'var.key': payload.identifier.key,
        },
      })
      .execute();

    const channel = remote.body.results[0];
    if (!channel) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
    }

    return success(this.factory.parseStore(this.context, channel));
  }

}
