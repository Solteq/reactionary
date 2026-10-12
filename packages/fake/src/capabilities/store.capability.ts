import type {
  Cache,
  FulfillmentCenterIdentifier,
  NotFoundError,
  RequestContext,
  Result,
  Store,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StoreIdentifier,
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
import * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeStoreFactory } from '../factories/store/store.factory.js';
import { calcSeed } from '../utilities/seed.js';

export class FakeStoreCapability<
  TFactory extends StoreFactory = FakeStoreFactory,
> extends StoreCapability<StoreFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: StoreFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: StoreFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.factory = factory;
  }

  /**
   * The countries the fake brand has physical stores in.
   */
  protected getStoreCountries(): string[] {
    return ['DK', 'SE', 'NO', 'FI', 'US'];
  }

  /**
   * How many physical stores the seed generates per country.
   */
  protected getStoresPerCountry(): number {
    return 3;
  }

  /**
   * The seeded set of physical stores: a fixed number per country, generated
   * deterministically from the store key.
   */
  protected getSeededStores(): StoreFactoryOutput<TFactory>[] {
    const stores: StoreFactoryOutput<TFactory>[] = [];

    for (const country of this.getStoreCountries()) {
      for (let i = 1; i <= this.getStoresPerCountry(); i++) {
        stores.push(this.generateStore(`${country.toLowerCase()}-${i}`, country));
      }
    }

    return stores;
  }

  protected generateStore(key: string, countryCode: string): StoreFactoryOutput<TFactory> {
    const generator = new Faker({
      seed: calcSeed(key),
      locale: [en, base],
    });

    const city = generator.location.city();

    return this.factory.parseStore(this.context, {
      identifier: {
        key,
      } satisfies StoreIdentifier,
      fulfillmentCenter: {
        key,
      } satisfies FulfillmentCenterIdentifier,
      name: `${generator.company.name()} ${city}`,
      address: {
        identifier: { nickName: key },
        firstName: '',
        lastName: '',
        streetAddress: generator.location.streetAddress(),
        streetNumber: '',
        city,
        region: '',
        postalCode: generator.location.zipCode('####'),
        countryCode,
      },
      openingHours: 'Mon-Fri 10am-6pm, Sat 10am-3pm',
    } satisfies Store);
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity,
  ): Promise<Result<StoreFactoryOutput<TFactory>[]>> {
    // The fake provider has no real geography; it returns the seeded stores
    // up to the requested limit.
    return success(this.getSeededStores().slice(0, payload.limit));
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    const stores = this.getSeededStores();
    const { pageNumber, pageSize } = payload.paginationOptions;

    const startIndex = (pageNumber - 1) * pageSize;

    return success({
      pageNumber,
      pageSize,
      totalCount: stores.length,
      totalPages: Math.ceil(stores.length / pageSize),
      items: stores.slice(startIndex, startIndex + pageSize),
    });
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    const store = this.getSeededStores().find(
      (candidate) => candidate.identifier.key === payload.identifier.key,
    );

    if (!store) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
    }

    return success(store);
  }
}
