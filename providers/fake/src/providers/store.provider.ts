import type {
  Cache,
  RequestContext,
  StoreQueryByProximity,
  Store,
} from '@reactionary/core';
import { StoreProvider } from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeStoreProvider<
  T extends Store = Store
> extends StoreProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }

  public override async queryByProximity(
    payload: StoreQueryByProximity
  ): Promise<T[]> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const results = [];

    for (let i = 0; i < payload.limit; i++) {
        const model = this.newModel();

        model.name = generator.company.name();
        model.identifier.key = '' + i;
        model.fulfillmentCenter.key = '' + i;

        results.push(model);
    }

    return results;
  }
}
