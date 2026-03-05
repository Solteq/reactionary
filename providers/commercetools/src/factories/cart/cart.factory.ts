import type { Cart as CTCart, LineItem } from '@commercetools/platform-sdk';
import {
  CartIdentifierSchema,
  CartItemSchema,
  CartSchema,
  type AnyCartIdentifierSchema,
  type AnyCartSchema,
  type Cart,
  type CartFactory,
  type CartIdentifier,
  type CartItem,
  type CostBreakDown,
  type Currency,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = typeof CartIdentifierSchema,
> implements CartFactory<TCartSchema, TCartIdentifierSchema>
{
  public readonly cartSchema: TCartSchema;
  public readonly cartIdentifierSchema: TCartIdentifierSchema;

  constructor(cartSchema: TCartSchema, cartIdentifierSchema: TCartIdentifierSchema) {
    this.cartSchema = cartSchema;
    this.cartIdentifierSchema = cartIdentifierSchema;
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: { key?: string },
  ): z.output<TCartIdentifierSchema> {
    return this.cartIdentifierSchema.parse({
      key: data.key || '',
    } satisfies Partial<CartIdentifier>);
  }

  public parseCart(
    context: RequestContext,
    data: CTCart,
  ): z.output<TCartSchema> {
    const identifier = this.parseCartIdentifier(context, {
      key: data.id,
    });

    const grandTotal = data.totalPrice.centAmount || 0;
    const shippingTotal = data.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = data.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal = data.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = data.totalPrice.currencyCode as Currency;

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

    const items: CartItem[] = [];
    for (const lineItem of data.lineItems) {
      items.push(this.parseCartItem(lineItem));
    }

    const result = {
      identifier,
      userId: {
        userId: '???',
      },
      name: data.custom?.fields['name'] || '',
      description: data.custom?.fields['description'] || '',
      price,
      items,
    } satisfies Cart;

    return this.cartSchema.parse(result);
  }

  protected parseCartItem(lineItem: LineItem): CartItem {
    const unitPrice = lineItem.price.value.centAmount;
    const totalPrice = lineItem.totalPrice.centAmount || 0;
    const totalDiscount = lineItem.price.discounted?.value.centAmount || 0;
    const unitDiscount = totalDiscount / lineItem.quantity;
    const currency = lineItem.price.value.currencyCode.toUpperCase() as Currency;

    return CartItemSchema.parse({
      identifier: {
        key: lineItem.id,
      },
      product: {
        key: lineItem.productId,
      },
      variant: {
        sku: lineItem.variant.sku || '',
      },
      quantity: lineItem.quantity,
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
    } satisfies Partial<CartItem>);
  }
}
