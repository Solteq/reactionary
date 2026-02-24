import type {
  Currency,
  MonetaryAmount,
  Price,
  PriceIdentifier,
} from '@reactionary/core';
import type {
  Price as CTPrice,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';

export function createEmptyCommercetoolsPriceResult(sku: string, currencyCode: string): Price {
  return {
    identifier: {
      variant: {
        sku,
      },
    },
    tieredPrices: [],
    unitPrice: {
      value: -1,
      currency: currencyCode as Currency,
    },
  } satisfies Price;
}

export function parseCommercetoolsPrice(
  body: CTProductVariant,
  currencyCode: string,
  options = { includeDiscounts: false },
): Price {
  const price = body.price as CTPrice | undefined;

  if (!price) {
    return createEmptyCommercetoolsPriceResult(body.sku!, currencyCode);
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
      sku: body.sku!,
    },
  } satisfies PriceIdentifier;

  return {
    identifier,
    tieredPrices: [],
    unitPrice,
  } satisfies Price;
}
