import {
  type Cache,
  type GenericError,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  StoreCapability,
  type StoreFactory,
  type StoreFactoryOutput,
  type StoreFactoryWithOutput,
  type StorePaginatedResult,
  type StoreQueryById,
  StoreQueryByIdSchema,
  type StoreQueryByProximity,
  StoreQueryByProximitySchema,
  type StoreQueryForList,
  StoreQueryForListSchema,
  StorePaginatedResultSchema,
  StoreSchema,
  error,
  success,
} from '@reactionary/core';
import * as z from 'zod';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclStoreFactory } from '../factories/store/store.factory.js';
import type { HclStoreLocatorResponse } from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:store');

export class HclStoreCapability<
  TFactory extends StoreFactory = HclStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected readonly config: HclConfiguration;
  protected readonly client: HclClient;
  protected readonly factory: StoreFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: StoreFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity,
  ): Promise<Result<StoreFactoryOutput<TFactory>[]>> {
    debug(
      'queryByProximity lat=%d lon=%d dist=%d',
      payload.latitude,
      payload.longitude,
      payload.distance,
    );

    const response = await this.client.callGet<HclStoreLocatorResponse>(
      this.getStoreLocatorUrl(payload),
      this.getStoreLocatorParams(payload),
      { allowUndefined: true },
    );

    const stores = (response?.PhysicalStore ?? []).map((store) =>
      this.factory.parseStore(this.context, store),
    );

    return success(stores);
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    const response = await this.client.callGet<HclStoreLocatorResponse>(
      this.getStoreByIdUrl(payload),
      new URLSearchParams(),
      { allowUndefined: true },
    );

    const store = response?.PhysicalStore?.[0];
    if (!store) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
    }

    return success(this.factory.parseStore(this.context, store));
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    _payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    // The HCL store locator only exposes geo and id based lookups; there is
    // no endpoint listing all physical stores. Use queryByProximity instead.
    return error<GenericError>({
      type: 'Generic',
      message:
        'The hcl store capability does not support listing all stores: the store locator only exposes geo and id based lookups. Use queryByProximity() instead.',
    });
  }

  // ---------------------------------------------------------------------------
  // Extension points
  // ---------------------------------------------------------------------------

  protected getStoreByIdUrl(payload: StoreQueryById): string {
    return `${this.client.transactionBaseUrl}/storelocator/byStoreId/${encodeURIComponent(payload.identifier.key)}`;
  }

  protected getStoreLocatorUrl(payload: StoreQueryByProximity): string {
    return `${this.client.transactionBaseUrl}/storelocator/latitude/${payload.latitude}/longitude/${payload.longitude}`;
  }

  protected getStoreLocatorParams(
    payload: StoreQueryByProximity,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('maxItems', String(payload.limit));
    params.set('radius', String(payload.distance));
    params.set('radiusUOM', 'km');
    params.set('siteLevelStoreSearch', 'false');
    return params;
  }
}
