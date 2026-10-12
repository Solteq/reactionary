import type { AdminStockLocation } from '@medusajs/types';
import type {
  Cache,
  GenericError,
  NotFoundError,
  RequestContext,
  Result,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StorePaginatedResult,
  StoreQueryById,
  StoreQueryByProximity,
  StoreQueryForList,
} from '@reactionary/core';
import {
  Reactionary,
  StoreCapability,
  StorePaginatedResultSchema,
  StoreQueryByIdSchema,
  StoreQueryByProximitySchema,
  StoreQueryForListSchema,
  StoreSchema,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import type { MedusaStoreFactory } from '../factories/store/store.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:store');

/**
 * Exposes Medusa stock locations that have a fulfillment set of type "pickup"
 * as the brand's own stores, for in-store pickup (BOPIS).
 */
export class MedusaStoreCapability<
  TFactory extends StoreFactory = MedusaStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: StoreFactoryWithOutput<TFactory>;

  /**
   * The fields requested for stock locations. Override in a subclass if a
   * project needs more relations.
   */
  protected stockLocationFields = '*address,*fulfillment_sets';

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: StoreFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * Whether a stock location is a store customers can pick up orders from,
   * i.e. it has a fulfillment set of type "pickup".
   */
  protected isPickupLocation(location: AdminStockLocation): boolean {
    return (location.fulfillment_sets || []).some((set) => set.type === 'pickup');
  }

  /**
   * Fetches all stock locations that are pickup stores. Medusa installations
   * have a small, bounded number of stock locations, so fetching them all and
   * filtering client-side is acceptable.
   */
  protected async fetchPickupLocations(): Promise<AdminStockLocation[]> {
    const adminClient = await new MedusaAdminAPI(this.config, this.context).getClient();

    const pageSize = 200;
    let offset = 0;
    const locations: AdminStockLocation[] = [];

    for (;;) {
      const response = await adminClient.admin.stockLocation.list({
        fields: this.stockLocationFields,
        limit: pageSize,
        offset,
      });

      locations.push(...(response.stock_locations || []));

      offset += pageSize;
      if (offset >= response.count || (response.stock_locations || []).length === 0) {
        break;
      }
    }

    return locations.filter((location) => this.isPickupLocation(location));
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    const pickupLocations = await this.fetchPickupLocations();

    if (debug.enabled) {
      debug(`Found ${pickupLocations.length} pickup stock locations`);
    }

    const { pageNumber, pageSize } = payload.paginationOptions;
    const startIndex = (pageNumber - 1) * pageSize;
    const pagedLocations = pickupLocations.slice(startIndex, startIndex + pageSize);

    return success({
      pageNumber,
      pageSize,
      totalCount: pickupLocations.length,
      totalPages: Math.ceil(pickupLocations.length / pageSize),
      items: pagedLocations.map((location) =>
        this.factory.parseStore(this.context, location),
      ),
    });
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    const adminClient = await new MedusaAdminAPI(this.config, this.context).getClient();

    try {
      const response = await adminClient.admin.stockLocation.retrieve(payload.id.key, {
        fields: this.stockLocationFields,
      });

      if (!response.stock_location || !this.isPickupLocation(response.stock_location)) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.id });
      }

      return success(this.factory.parseStore(this.context, response.stock_location));
    } catch (err) {
      if (debug.enabled) {
        debug(`Error fetching stock location ${payload.id.key}`, err);
      }
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.id });
    }
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    _payload: StoreQueryByProximity,
  ): Promise<Result<Array<StoreFactoryOutput<TFactory>>>> {
    // Medusa stock locations carry no geo coordinates, so proximity search is
    // not supported for this provider. Use list() instead.
    return error<GenericError>({
      type: 'Generic',
      message:
        'The medusa store capability does not support proximity queries: stock locations have no geo coordinates. Use list() instead.',
    });
  }
}
