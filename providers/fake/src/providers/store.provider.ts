import type {
  Cache,
  FulfillmentCenterIdentifier,
  RequestContext,
  Store,
  StoreIdentifier,
  StoreQueryByProximity,
  Result
} from '@reactionary/core';
import { Reactionary, StoreProvider, StoreQueryByProximitySchema, StoreSchema, success } from '@reactionary/core';
import * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeStoreProvider extends StoreProvider {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: StoreQueryByProximitySchema,
    outputSchema: z.array(StoreSchema)
  })
  public override async queryByProximity(
    payload: StoreQueryByProximity
  ): Promise<Result<Store[]>> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const results = new Array<Store>();

    for (let i = 0; i < payload.limit; i++) {
        const name = generator.company.name();
        const identifier = {
          key: '' + i
        } satisfies StoreIdentifier;
        const fulfillmentCenter = {
          key: '' + i
        } satisfies FulfillmentCenterIdentifier;

        results.push({
          fulfillmentCenter,
          identifier,
          name
        });
    }

    return success(results);
  }
}
