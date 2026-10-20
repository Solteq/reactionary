import type {
  Cache,
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
import type { MagentoClient } from '../core/client.js';
import { PICKUP_LOCATIONS_QUERY } from '../core/store.graphql.js';
import type { MagentoStoreFactory } from '../factories/store/store.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import {
  MagentoCachedPickupLocationsSchema,
  MagentoPickupLocationsResponseSchema,
  type MagentoPickupLocation,
} from '../schema/store.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';
import { resolveMagentoStoreViewCodeForContext } from '../utils/magento-store-view.js';

const debug = createDebug('reactionary:magento:store');

const EARTH_RADIUS_KM = 6371;
const DEFAULT_PICKUP_LOCATIONS_CACHE_TTL_SECONDS = 300;

/** Great-circle distance between two coordinates in kilometers (haversine). */
export function haversineDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Exposes Magento MSI in-store pickup locations as the brand's stores (BOPIS),
 * through the storefront `pickupLocations` GraphQL query.
 *
 * `queryByProximity` takes `distance` in kilometers. Magento's own `area`
 * filter needs a geocodable search term rather than coordinates, so every
 * pickup location of the store view is fetched (cached for
 * `storeLocationsCacheTtlSeconds`) and filtered with a haversine distance.
 */
export class MagentoStoreCapability<
  TFactory extends StoreFactory = MagentoStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: StoreFactoryWithOutput<TFactory>;

  /** Page size used when fetching every pickup location. */
  protected fetchAllPageSize = 100;
  /** Upper bound on pages fetched, so a misbehaving API can't loop forever. */
  protected fetchAllMaxPages = 50;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: StoreFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async fetchPickupLocationsPage(
    pageSize: number,
    currentPage: number,
    filters?: Record<string, unknown>,
  ): Promise<{ locations: MagentoPickupLocation[]; totalCount: number }> {
    const data = await this.magentoApi.graphqlRequest<unknown>(PICKUP_LOCATIONS_QUERY, {
      pageSize,
      currentPage,
      filters,
    });
    const page = MagentoPickupLocationsResponseSchema.parse(data).pickupLocations;
    const locations = (page?.items ?? []).filter(
      (location): location is MagentoPickupLocation => location !== null,
    );
    return { locations, totalCount: page?.total_count ?? locations.length };
  }

  protected pickupLocationsCacheKey(): string {
    const storeView = resolveMagentoStoreViewCodeForContext(this.config.storeBaseCode, this.context);
    return `magento:pickup-locations:${storeView || 'default'}`;
  }

  /** Every pickup location of the request's store view, cached per store view. */
  protected async fetchAllPickupLocations(): Promise<MagentoPickupLocation[]> {
    const cacheKey = this.pickupLocationsCacheKey();
    const cached = await this.cache.get(cacheKey, MagentoCachedPickupLocationsSchema);
    if (cached) {
      return cached.locations;
    }

    const locations: MagentoPickupLocation[] = [];
    for (let currentPage = 1; currentPage <= this.fetchAllMaxPages; currentPage++) {
      const page = await this.fetchPickupLocationsPage(this.fetchAllPageSize, currentPage);
      locations.push(...page.locations);
      if (page.locations.length < this.fetchAllPageSize || locations.length >= page.totalCount) {
        break;
      }
    }

    await this.cache.put(
      cacheKey,
      { locations },
      {
        ttlSeconds:
          this.config.storeLocationsCacheTtlSeconds ?? DEFAULT_PICKUP_LOCATIONS_CACHE_TTL_SECONDS,
        dependencyIds: [],
      },
    );
    return locations;
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(payload: StoreQueryForList): Promise<Result<StorePaginatedResult>> {
    const { pageNumber, pageSize } = payload.paginationOptions;
    try {
      const page = await this.fetchPickupLocationsPage(pageSize, pageNumber);
      return success({
        pageNumber,
        pageSize,
        totalCount: page.totalCount,
        totalPages: Math.ceil(page.totalCount / pageSize),
        items: page.locations.map((location) => this.factory.parseStore(this.context, location)),
      });
    } catch (err) {
      return handleMagentoProviderError('list stores', err);
    }
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    try {
      const page = await this.fetchPickupLocationsPage(1, 1, {
        pickup_location_code: { eq: payload.identifier.key },
      });
      const location = page.locations.find(
        (candidate) => candidate.pickup_location_code === payload.identifier.key,
      );
      if (!location) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
      }
      return success(this.factory.parseStore(this.context, location));
    } catch (err) {
      return handleMagentoProviderError('get store', err, payload.identifier);
    }
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity,
  ): Promise<Result<Array<StoreFactoryOutput<TFactory>>>> {
    try {
      const locations = await this.fetchAllPickupLocations();

      const withinDistance: Array<{ location: MagentoPickupLocation; distance: number }> = [];
      for (const location of locations) {
        // Locations without coordinates cannot be placed and never match.
        if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
          continue;
        }
        const distance = haversineDistanceKm(
          payload.latitude,
          payload.longitude,
          location.latitude,
          location.longitude,
        );
        if (distance <= payload.distance) {
          withinDistance.push({ location, distance });
        }
      }

      withinDistance.sort((a, b) => a.distance - b.distance);
      debug('%d of %d pickup locations within %d km', withinDistance.length, locations.length, payload.distance);

      return success(
        withinDistance
          .slice(0, payload.limit)
          .map((entry) => this.factory.parseStore(this.context, entry.location)),
      );
    } catch (err) {
      return handleMagentoProviderError('query stores by proximity', err);
    }
  }
}
