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
import type * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import { calcSeed } from '../utilities/seed.js';

export class FakePriceProvider extends PriceProvider {
  protected config: FakeConfiguration;
  protected faker: Faker;
  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
    this.faker = new Faker({
      locale: [en, base],
    });
  }

  protected createPrice(variantSku: string, mode: 'list' | 'customer'): Price {
    const seed = calcSeed(variantSku);
    this.faker.seed(seed);
    let price = this.faker.number.int({ min: 300, max: 100000 }) / 100;
    let onSale = false;
    if (mode === 'customer') {
      // For customer price, randomly decide if the product is on sale
      onSale = this.faker.datatype.boolean({ probability: 0.1 }); // 10% chance of being on sale

      if (onSale) {
        price = price * this.faker.number.float({ min: 0.5, max: 0.9 }); // Apply a random discount between 10% and 50%
      }
    }

    const tiers = [];
    if (variantSku.includes('with-tiers')) {
      // Add tiered pricing for SKUs that include "with-tiers"
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 2, max: 5 }),
        price: {
          value: price * 0.8, // 20% discount for tier 1
          currency: this.context.languageContext.currencyCode,
        },
      });
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 6, max: 10 }),
        price: {
          value: price * 0.6, // 40% discount for tier 2
          currency: this.context.languageContext.currencyCode,
        },
      });
    }


    return {
      identifier: {
        variant: {
          sku: variantSku,
        },
      },
      unitPrice: {
        value: price,
        currency: this.context.languageContext.currencyCode,
      },
      onSale,
      tieredPrices: tiers,
    }
  }



  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema
  })
  public override async getListPrice(payload: ListPriceQuery): Promise<Result<Price>> {
    if (payload.variant.sku === 'unknown-sku') {
      return success(this.createEmptyPriceResult(payload.variant.sku));
    }

    return success(this.createPrice(payload.variant.sku, 'list'));
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema
  })
  public override async getCustomerPrice(payload: CustomerPriceQuery): Promise<Result<Price>> {
    if (payload.variant.sku === 'unknown-sku') {
      return success(this.createEmptyPriceResult(payload.variant.sku));
    }

    return success(this.createPrice(payload.variant.sku, 'customer'));
  }
}
