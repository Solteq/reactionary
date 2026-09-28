import {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceCapability,
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

export class FakePriceCapability<
  TFactory extends PriceFactory = FakePriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected faker: Faker;
  protected factory: PriceFactoryWithOutput<TFactory>;

  protected EXCHANGE_RATES: Record<string, number> = {
    USD: 1,
    // USD-base rates published on 2026-09-28.
    ALL: 80.77663447,
    AMD: 364.40085393,
    AZN: 1.70002087,
    BAM: 1.71729191,
    BYN: 3.02436738,
    CHF: 0.82937207,
    CZK: 21.40268821,
    DKK: 6.56376981,
    EUR: 0.87803741,
    FOK: 6.56376981,
    GBP: 0.75495717,
    GEL: 2.59828739,
    GGP: 0.75495717,
    GIP: 0.75495717,
    HUF: 321.3111657,
    IMP: 0.75495717,
    ISK: 120.29041481,
    JEP: 0.75495717,
    MDL: 17.7583979,
    MKD: 54.07860616,
    NOK: 9.51139889,
    PLN: 3.83998104,
    RON: 4.6300027,
    RSD: 103.15758559,
    RUB: 84.38052987,
    SEK: 9.92541411,
    TRY: 48.97845183,
    UAH: 44.79455454,
  };
  protected CURRENCY_DECIMAL_PLACES: Record<string, number> = {
    ISK: 0,
  };

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

    const currency = this.context.languageContext.currencyCode;
    price = this.roundCurrencyAmount(price * (this.EXCHANGE_RATES[currency] ?? 1), currency);

    const tiers = [];
    if (variantSku.includes('with-tiers')) {
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 2, max: 5 }),
        price: {
          value: this.roundCurrencyAmount(price * 0.8, currency),
          currency,
        },
      });
      tiers.push({
        minimumQuantity: this.faker.number.int({ min: 6, max: 10 }),
        price: {
          value: this.roundCurrencyAmount(price * 0.6, currency),
          currency,
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
        currency,
      },
      onSale,
      tieredPrices: tiers,
    };
  }

  protected roundCurrencyAmount(amount: number, currency: string): number {
    const decimalPlaces = this.CURRENCY_DECIMAL_PLACES[currency] ?? 2;
    const multiplier = 10 ** decimalPlaces;
    return Math.round((amount + Number.EPSILON) * multiplier) / multiplier;
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
