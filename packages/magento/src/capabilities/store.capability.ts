import type {
  Cache,
  RequestContext,
  Result,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StoreQueryByProximity,
} from '@reactionary/core';
import {
  Reactionary,
  StoreCapability,
  StoreQueryByProximitySchema,
  StoreSchema,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import type { MagentoStoreFactory } from '../factories/store/store.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoSource } from '../schema/magento.types.js';

const debug = createDebug('reactionary:magento:store');

const SOURCES_PAGE_SIZE = 500;
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Stores are Magento MSI inventory sources. MSI has no geo query, so every
 * enabled source is read over the admin channel and the proximity filter
 * (radius in kilometres, like commercetools), nearest-first sort and limit
 * are applied in memory. Sources without coordinates are never returned.
 */
export class MagentoStoreCapability<
  TFactory extends StoreFactory = MagentoStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: StoreFactoryWithOutput<TFactory>;

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

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity,
  ): Promise<Result<Array<StoreFactoryOutput<TFactory>>>> {
    const sources = await this.fetchAllSources();

    const nearby: Array<{ source: MagentoSource; distance: number }> = [];
    for (const source of sources) {
      if (!source.enabled || source.latitude == null || source.longitude == null) {
        continue;
      }
      const distance = haversineKm(
        payload.latitude,
        payload.longitude,
        source.latitude,
        source.longitude,
      );
      if (distance <= payload.distance) {
        nearby.push({ source, distance });
      }
    }

    nearby.sort((a, b) => a.distance - b.distance);
    debug('queryByProximity: %d of %d sources in range', nearby.length, sources.length);

    return success(
      nearby
        .slice(0, payload.limit)
        .map(({ source }) => this.factory.parseStore(this.context, source)),
    );
  }

  protected async fetchAllSources(): Promise<MagentoSource[]> {
    const sources: MagentoSource[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams();
      params.set('searchCriteria[pageSize]', String(SOURCES_PAGE_SIZE));
      params.set('searchCriteria[currentPage]', String(page));
      const response = await this.magentoApi.searchInventorySources(params);
      const items = response.items ?? [];
      sources.push(...items);
      if (items.length === 0 || sources.length >= (response.total_count ?? 0)) {
        return sources;
      }
    }
  }
}
