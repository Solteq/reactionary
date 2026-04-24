import type {
  AnyPriceSchema,
  Currency,
  MonetaryAmount,
  Price,
  PriceFactory,
  PriceIdentifier,
  PriceSchema,
  RequestContext,
  TieredPrice,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MagentoProduct } from '../../schema/magento.types.js';

export interface MagentoPriceParseInput {
  product: MagentoProduct;
  sku: string;
  mode: 'list' | 'customer';
}

export class MagentoPriceFactory<
  TPriceSchema extends AnyPriceSchema = typeof PriceSchema,
> implements PriceFactory<TPriceSchema>
{
  public readonly priceSchema: TPriceSchema;

  constructor(priceSchema: TPriceSchema) {
    this.priceSchema = priceSchema;
  }

  public parsePrice(
    context: RequestContext,
    data: unknown,
    _options?: { includeDiscounts: boolean },
  ): z.output<TPriceSchema> {
    const input = data as MagentoPriceParseInput;
    const { product, sku, mode } = input;

    const identifier = {
      variant: { sku },
    } satisfies PriceIdentifier;

    const basePrice = product.price ?? 0;

    const specialPriceAttr = product.custom_attributes?.find((a) => a.attribute_code === 'special_price');
    const specialPrice = specialPriceAttr ? Number(specialPriceAttr.value) : undefined;

    const finalPrice = (mode === 'customer' && specialPrice !== undefined) ? specialPrice : basePrice;

    const unitPrice = {
      value: finalPrice,
      currency: (context.languageContext.currencyCode || 'USD') as Currency,
    } satisfies MonetaryAmount;

    const tieredPrices: TieredPrice[] = [];
    if (product.tier_prices) {
      for (const tier of product.tier_prices) {
        tieredPrices.push({
          minimumQuantity: tier.qty,
          price: {
            value: tier.value,
            currency: (context.languageContext.currencyCode || 'USD') as Currency,
          },
        });
      }
    }

    const result = {
      identifier,
      unitPrice,
      onSale: false,
      tieredPrices,
    } satisfies Price;

    return this.priceSchema.parse(result);
  }
}
