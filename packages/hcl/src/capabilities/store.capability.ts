import {
  type Cache,
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

  /**
   * A radius in kilometers that covers the entire globe from any origin: the
   * maximum great-circle distance between two points on Earth is ~20,015 km.
   */
  protected getGlobalRadiusKm(): number {
    return 25000;
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    // The HCL store locator only exposes geo and id based lookups, so the
    // list is synthesized as a proximity search from (0, 0) with a
    // globe-covering radius, paged via the standard WCS record-set
    // parameters.
    const response = await this.client.callGet<HclStoreLocatorResponse>(
      this.getStoreListUrl(payload),
      this.getStoreListParams(payload),
      { allowUndefined: true },
    );

    const { pageNumber, pageSize } = payload.paginationOptions;

    const physicalStores = response?.PhysicalStore ?? [];
    const requestedPageStart = (pageNumber - 1) * pageSize;

    // Defensive: if the endpoint ignored the pagination parameters and
    // returned a larger record set, page it client-side instead.
    const pageStores =
      physicalStores.length > pageSize
        ? physicalStores.slice(requestedPageStart, requestedPageStart + pageSize)
        : physicalStores;

    const reportedTotal = Number(response?.recordSetTotal);
    const totalCount = Number.isFinite(reportedTotal)
      ? reportedTotal
      : physicalStores.length;

    return success({
      pageNumber,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      items: pageStores.map((store) => this.factory.parseStore(this.context, store)),
    });
  }

  // ---------------------------------------------------------------------------
  // Extension points
  // ---------------------------------------------------------------------------

  protected getStoreByIdUrl(payload: StoreQueryById): string {
    return `${this.client.transactionBaseUrl}/storelocator/byStoreId/${encodeURIComponent(payload.identifier.key)}`;
  }

  protected getStoreListUrl(_payload: StoreQueryForList): string {
    return `${this.client.transactionBaseUrl}/storelocator/latitude/0/longitude/0`;
  }

  protected getStoreListParams(payload: StoreQueryForList): URLSearchParams {
    const params = new URLSearchParams();
    params.set('radius', String(this.getGlobalRadiusKm()));
    params.set('radiusUOM', 'km');
    params.set('siteLevelStoreSearch', 'false');
    params.set('pageNumber', String(payload.paginationOptions.pageNumber));
    params.set('pageSize', String(payload.paginationOptions.pageSize));
    return params;
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
