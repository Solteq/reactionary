import type {
  Cache,
  FulfillmentCenterIdentifier,
  RequestContext,
  Result,
  StoreFactory,
  StoreFactoryOutput,
  StoreFactoryWithOutput,
  StoreIdentifier,
  StoreQueryByProximity,
} from '@reactionary/core';
import {
  Reactionary,
  StoreProvider,
  StoreQueryByProximitySchema,
  StoreSchema,
  success,
} from '@reactionary/core';
import * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeStoreFactory } from '../factories/store/store.factory.js';

export class FakeStoreProvider<
  TFactory extends StoreFactory = FakeStoreFactory,
> extends StoreProvider<StoreFactoryOutput<TFactory>> {
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
      results.push(
        this.factory.parseStore(this.context, {
          identifier: {
            key: `${i}`,
          } satisfies StoreIdentifier,
          fulfillmentCenter: {
            key: `${i}`,
          } satisfies FulfillmentCenterIdentifier,
          name: generator.company.name(),
        }),
      );
    }

    return success(results);
  }
}
