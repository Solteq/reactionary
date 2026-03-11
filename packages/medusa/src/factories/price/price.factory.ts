import type { StoreProductVariant } from '@medusajs/types';
import type {
  AnyPriceSchema,
  Currency,
  MonetaryAmount,
  Price,
  PriceFactory,
  PriceIdentifier,
  PriceSchema,
  RequestContext
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaPriceFactoryParseInput {
  variant: StoreProductVariant,
  mode: 'list' | 'customer',
}

export class MedusaPriceFactory<
  TPriceSchema extends AnyPriceSchema = typeof PriceSchema,
> implements PriceFactory<TPriceSchema>
{
  public readonly priceSchema: TPriceSchema;

  constructor(priceSchema: TPriceSchema) {
    this.priceSchema = priceSchema;
  }

  public parsePrice(
    context: RequestContext,
    data: MedusaPriceFactoryParseInput,
    _options?: { includeDiscounts: boolean },
  ): z.output<TPriceSchema> {

   const identifier = {
      variant: {
        sku: data.variant.sku || '',
      },
    } satisfies PriceIdentifier;

    // In Medusa v2, calculated_price contains the final price for the variant
    // based on the region, currency, and any applicable price lists
    const calculatedPrice = data.variant.calculated_price;
    let unitPrice;
    let isOnSale = false;
    if (calculatedPrice) {
      const priceToUse = data.mode === 'customer' ? calculatedPrice.calculated_amount : calculatedPrice.original_amount;

      if (data.mode === 'customer') {
        isOnSale = calculatedPrice.calculated_price?.price_list_type === 'sale'
      }

      unitPrice = {
        value: priceToUse || 0,
        currency: (calculatedPrice.currency_code?.toUpperCase() ||
          context.languageContext.currencyCode) as Currency,
      } satisfies MonetaryAmount;
    } else {
      // Fallback to empty price if no calculated price available
      unitPrice = {
        value: -1,
        currency: context.languageContext.currencyCode as Currency,
      } satisfies MonetaryAmount;
    }

    const result = {
      identifier,
      tieredPrices: [],
      unitPrice,
      onSale: isOnSale,
    } satisfies Price;
    return this.priceSchema.parse(result);
  }
}
