import {
  type RequestContext,
  type Cache,
  PriceProvider,
  type CustomerPriceQuery,
  type ListPriceQuery,
  type Price,
  Reactionary,
  CustomerPriceQuerySchema,
  PriceSchema,
  ListPriceQuerySchema,
  error,
  success,
  type Result,
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakePriceProvider extends PriceProvider {
  protected config: FakeConfiguration;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema
  })
  public override async getListPrice(payload: ListPriceQuery): Promise<Result<Price>> {
    if (payload.variant.sku === 'unknown-sku') {
      return success(this.createEmptyPriceResult(payload.variant.sku));
    }

    // Generate a simple hash from the SKU key string for seeding
    let hash = 0;
    const skuString = payload.variant.sku;
    for (let i = 0; i < skuString.length; i++) {
      hash = (hash << 5) - hash + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const model = {
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
    } as Price;

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
          },
        },
        {
          minimumQuantity: generator.number.int({ min: 6, max: 10 }),
          price: {
            value: tier2Price,
            currency: this.context.languageContext.currencyCode,
          },
        },
      ];
    } else {
      model.tieredPrices = [];
    }

    return success(model);
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema
  })
  public override async getCustomerPrice(payload: CustomerPriceQuery): Promise<Result<Price>> {
    if (payload.variant.sku === 'unknown-sku') {
      return success(this.createEmptyPriceResult(payload.variant.sku));
    }

    // Generate a simple hash from the SKU key string for seeding
    let hash = 0;
    const skuString = payload.variant.sku;
    for (let i = 0; i < skuString.length; i++) {
      hash = (hash << 5) - hash + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const model = {
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
    } as Price;

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
          },
        },
        {
          minimumQuantity: generator.number.int({ min: 6, max: 10 }),
          price: {
            value: tier2Price,
            currency: this.context.languageContext.currencyCode,
          },
        },
      ];
    } else {
      model.tieredPrices = [];
    }

    return success(model);
  }
}
