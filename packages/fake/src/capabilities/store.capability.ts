import type {
  Cache,
  FulfillmentCenterIdentifier,
  NotFoundError,
  RequestContext,
  Result,
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
  success,
} from '@reactionary/core';
import * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeStoreFactory } from '../factories/store/store.factory.js';

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

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema),
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity,
  ): Promise<Result<StoreFactoryOutput<TFactory>[]>> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const results: StoreFactoryOutput<TFactory>[] = [];

    for (let i = 0; i < payload.limit; i++) {
      results.push(this.generateStore(generator, `${i}`));
    }

    return success(results);
  }

  /**
   * How many fake stores exist in total for the paged list.
   */
  protected getTotalStoreCount(): number {
    return 25;
  }

  protected generateStore(
    generator: Faker,
    key: string,
  ): StoreFactoryOutput<TFactory> {
    return this.factory.parseStore(this.context, {
      identifier: {
        key,
      } satisfies StoreIdentifier,
      fulfillmentCenter: {
        key,
      } satisfies FulfillmentCenterIdentifier,
      name: generator.company.name(),
    });
  }

  @Reactionary({
    inputSchema: StoreQueryForListSchema,
    outputSchema: StorePaginatedResultSchema,
  })
  public override async list(
    payload: StoreQueryForList,
  ): Promise<Result<StorePaginatedResult>> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const { pageNumber, pageSize } = payload.paginationOptions;
    const totalCount = this.getTotalStoreCount();

    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);

    const items: StoreFactoryOutput<TFactory>[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      items.push(this.generateStore(generator, `${i}`));
    }

    return success({
      pageNumber,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      items,
    });
  }

  @Reactionary({
    inputSchema: StoreQueryByIdSchema,
    outputSchema: StoreSchema,
  })
  public override async getById(
    payload: StoreQueryById,
  ): Promise<Result<StoreFactoryOutput<TFactory>, NotFoundError>> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    return success(this.generateStore(generator, payload.identifier.key));
  }
}
