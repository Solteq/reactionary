import type {
  Cache,
  FulfillmentCenterIdentifier,
  Meta,
  RequestContext,
  Store,
  StoreIdentifier,
  StoreQueryByProximity
} from '@reactionary/core';
import { Reactionary, StoreProvider, StoreQueryByProximitySchema, StoreSchema } from '@reactionary/core';
import z from 'zod';
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
  ): Promise<Store[]> {
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
        const meta = {
          cache: {
            hit: false,
            key: '' + i,
          },
          placeholder: false
        } satisfies Meta;

        results.push({
          fulfillmentCenter,
          identifier,
          meta,
          name
        });
    }

    return results;
  }
}
