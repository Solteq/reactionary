import {
  type Price,
  type PriceQueryBySku,
  type RequestContext,
  type Cache,
  PriceProvider,
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakePriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }

  public override async getBySKUs(payload: PriceQueryBySku[]): Promise<T[]> {

    const promises = payload.map(p => this.getBySKU(p));
    const result = await Promise.all(promises);
    return result;
  }

  public override async getBySKU(
    payload: PriceQueryBySku
  ): Promise<T> {

    if (payload.variant.sku === 'unknown-sku') {
      return this.createEmptyPriceResult(payload.variant.sku);
    }

    // Generate a simple hash from the SKU key string for seeding
    let hash = 0;
    const skuString = payload.variant.sku;
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
        variant: payload.variant,
      },
      unitPrice: {
        value: generator.number.int({ min: 300, max: 100000 }) / 100,
        currency: this.context.languageContext.currencyCode,
      },
      meta: {
        cache: {
          hit: false,
          key: payload.variant.sku,
        },
        placeholder: false,
      },
    });

    if (skuString.includes('with-tiers')) {
      const unitPrice = model.unitPrice?.value || 0;
      // Ensure tiered prices are less than the unit price
      const tier1Price = unitPrice * 0.8;
      const tier2Price = tier1Price * 0.8;
      model.tieredPrices = [
        {
          minimumQuantity: generator.number.int({ min: 2, max: 5 }),
          price: {
            value: tier1Price,
            currency: this.context.languageContext.currencyCode,
          }
        },
        {
          minimumQuantity: generator.number.int({ min: 6, max: 10 }),
          price: {
            value: tier2Price,
            currency: this.context.languageContext.currencyCode,
          }
        }
      ];
    } else {
      model.tieredPrices = [];
    }



    return this.assert(model);
  }
}
