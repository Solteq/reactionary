import {
  Price,
  PriceProvider,
  PriceQueryBySku,
  Session, RequestContext,
  Cache,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';

export class FakePriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async getBySKUs(payload: PriceQueryBySku[], reqCtx: RequestContext): Promise<T[]> {

    const promises = payload.map(p => this.getBySKU(p, reqCtx));
    const result = await Promise.all(promises);
    return result;
  }

  public override async getBySKU(
    payload: PriceQueryBySku,
    _reqCtx: RequestContext
  ): Promise<T> {

    if (payload.sku.key === 'unknown-sku') {
      return this.createEmptyPriceResult(payload.sku.key, _reqCtx.languageContext.currencyCode);
    }

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
      unitPrice: {
        value: generator.number.int({ min: 300, max: 100000 }) / 100,
        currency: _reqCtx.languageContext.currencyCode,
      },
      meta: {
        cache: {
          hit: false,
          key: payload.sku.key,
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
            currency: _reqCtx.languageContext.currencyCode,
          }
        },
        {
          minimumQuantity: generator.number.int({ min: 6, max: 10 }),
          price: {
            value: tier2Price,
            currency: _reqCtx.languageContext.currencyCode,
          }
        }
      ];
    } else {
      model.tieredPrices = [];
    }



    return this.assert(model);
  }
}
