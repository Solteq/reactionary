import {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceProvider,
  PriceSchema,
  Reactionary,
  success,
  type Cache,
  type CustomerPriceQuery,
  type ListPriceQuery,
  type Price,
  type PriceFactory,
  type PriceFactoryOutput,
  type PriceFactoryWithOutput,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import { calcSeed } from '../utilities/seed.js';
import type { FakePriceFactory } from '../factories/price/price.factory.js';

export class FakePriceProvider<
  TFactory extends PriceFactory = FakePriceFactory,
> extends PriceProvider<PriceFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected faker: Faker;
  protected factory: PriceFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: PriceFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.faker = new Faker({
      locale: [en, base],
    });
    this.factory = factory;
  }

  protected createPrice(variantSku: string, mode: 'list' | 'customer'): Price {
    const seed = calcSeed(variantSku);
    this.faker.seed(seed);
    let price = this.faker.number.int({ min: 300, max: 100000 }) / 100;
    let onSale = false;
    if (mode === 'customer') {
      onSale = this.faker.datatype.boolean({ probability: 0.1 });
      if (onSale) {
        price = price * this.faker.number.float({ min: 0.5, max: 0.9 });
      }
    }

    const tiers = [];
    if (variantSku.includes('with-tiers')) {
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 2, max: 5 }),
        price: {
          value: price * 0.8,
          currency: this.context.languageContext.currencyCode,
        },
      });
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 6, max: 10 }),
        price: {
          value: price * 0.6,
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
    };
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(
    payload: ListPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const base =
      payload.variant.sku === 'unknown-sku'
        ? this.createEmptyPriceResult(payload.variant.sku)
        : this.createPrice(payload.variant.sku, 'list');

    return success(this.factory.parsePrice(this.context, base));
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const base =
      payload.variant.sku === 'unknown-sku'
        ? this.createEmptyPriceResult(payload.variant.sku)
        : this.createPrice(payload.variant.sku, 'customer');

    return success(this.factory.parsePrice(this.context, base));
  }
}
