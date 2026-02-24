import type {
  Cart,
  CartIdentifier,
  CartItem,
  CostBreakDown,
  Currency,
} from '@reactionary/core';
import { CartItemSchema } from '@reactionary/core';
import type {
  Cart as CTCart,
  LineItem,
} from '@commercetools/platform-sdk';

type VersionedCartIdentifier = CartIdentifier & { version: number };

export function parseCommercetoolsCartItem(remoteItem: LineItem): CartItem {
  const unitPrice = remoteItem.price.value.centAmount;
  const totalPrice = remoteItem.totalPrice.centAmount || 0;
  const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
  const unitDiscount = totalDiscount / remoteItem.quantity;
  const currency = remoteItem.price.value.currencyCode.toUpperCase() as Currency;

  return CartItemSchema.parse({
    identifier: {
      key: remoteItem.id,
    },
    product: {
      key: remoteItem.productId,
    },
    variant: {
      sku: remoteItem.variant.sku || '',
    },
    quantity: remoteItem.quantity,
    price: {
      unitPrice: {
        value: unitPrice / 100,
        currency,
      },
      unitDiscount: {
        value: unitDiscount / 100,
        currency,
      },
      totalPrice: {
        value: totalPrice / 100,
        currency,
      },
      totalDiscount: {
        value: totalDiscount / 100,
        currency,
      },
    },
  } satisfies CartItem);
}

export function parseCommercetoolsCart(remote: CTCart): Cart {
  const identifier = {
    key: remote.id,
    version: remote.version || 0,
  } satisfies VersionedCartIdentifier;

  const grandTotal = remote.totalPrice.centAmount || 0;
  const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
  const productTotal = grandTotal - shippingTotal;
  const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
  const discountTotal = remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
  const surchargeTotal = 0;
  const currency = remote.totalPrice.currencyCode as Currency;

  const price = {
    totalTax: {
      value: taxTotal / 100,
      currency,
    },
    totalDiscount: {
      value: discountTotal / 100,
      currency,
    },
    totalSurcharge: {
      value: surchargeTotal / 100,
      currency,
    },
    totalShipping: {
      value: shippingTotal / 100,
      currency,
    },
    totalProductPrice: {
      value: productTotal / 100,
      currency,
    },
    grandTotal: {
      value: grandTotal / 100,
      currency,
    },
  } satisfies CostBreakDown;

  return {
    identifier,
    userId: {
      userId: '???',
    },
    name: remote.custom?.fields['name'] || '',
    description: remote.custom?.fields['description'] || '',
    price,
    items: remote.lineItems.map(parseCommercetoolsCartItem),
  } satisfies Cart;
}
