import type { Price as CTPrice, ProductVariant as CTProductVariant } from '@commercetools/platform-sdk';
import {
  PriceSchema,
  type AnyPriceSchema,
  type Currency,
  type MonetaryAmount,
  type Price,
  type PriceFactory,
  type PriceIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsPriceFactory<
  TPriceSchema extends AnyPriceSchema = typeof PriceSchema,
> implements PriceFactory<TPriceSchema>
{
  public readonly priceSchema: TPriceSchema;

  constructor(priceSchema: TPriceSchema) {
    this.priceSchema = priceSchema;
  }

  public parsePrice(
    context: RequestContext,
    data: CTProductVariant,
    options = { includeDiscounts: false },
  ): z.output<TPriceSchema> {
    const price = data.price as CTPrice | undefined;

    if (!price) {
      return this.priceSchema.parse({
        identifier: {
          variant: {
            sku: data.sku || '',
          },
        },
        tieredPrices: [],
        unitPrice: {
          value: -1,
          currency: context.languageContext.currencyCode,
        },
      } satisfies Price);
    }

    let unitPrice = {
      value: price.value.centAmount / 100,
      currency: price.value.currencyCode as Currency,
    } satisfies MonetaryAmount;

    if (options.includeDiscounts) {
      const discountedPrice = price.discounted?.value || price.value;
      unitPrice = {
        value: discountedPrice.centAmount / 100,
        currency: price.value.currencyCode as Currency,
      } satisfies MonetaryAmount;
    }

    const identifier = {
      variant: {
        sku: data.sku || '',
      },
    } satisfies PriceIdentifier;

    const result = {
      identifier,
      tieredPrices: [],
      unitPrice,
    } satisfies Price;

    return this.priceSchema.parse(result);
  }
}
