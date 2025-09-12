import {
  Price,
  PriceProvider,
  PriceQueryBySku,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';

export class FakePriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }

  public override async getBySKU(
    payload: PriceQueryBySku,
    session: Session
  ): Promise<T> {
    // Generate a simple hash from the SKU key string for seeding
    let hash = 0;
    const skuString = payload.sku.key;
    for (let i = 0; i < skuString.length; i++) {
      hash = ((hash << 5) - hash) + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const model = this.newModel();
    Object.assign(model, {
      identifier: {
        sku: payload.sku,
      },
      value: {
        cents: generator.number.int({ min: 100, max: 100000 }),
        currency: 'USD',
      },
      meta: {
        cache: {
          hit: false,
          key: payload.sku,
        },
        placeholder: false,
      },
    });

    return this.assert(model);
  }
}