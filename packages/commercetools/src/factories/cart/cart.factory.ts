import type {
  CartPagedQueryResponse,
  Cart as CTCart,
  LineItem,
} from '@commercetools/platform-sdk';
import type {
  AnyCartPaginatedSearchResult,
  CartPaginatedSearchResult,
  CartPaginatedSearchResultSchema,
  CartQueryList,
  CartSchema,
  CartSearchResultItem,
  CompanyIdentifier,
  Promotion
} from '@reactionary/core';
import {
  CartItemSchema,
  type AnyCartIdentifierSchema,
  type AnyCartSchema,
  type Cart,
  type CartFactory,
  type CartItem,
  type CostBreakDown,
  type Currency,
  type RequestContext
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  CommercetoolsCartIdentifier,
  CommercetoolsCartIdentifierSchema,
} from '../../schema/commercetools.schema.js';

export class CommercetoolsCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends
    AnyCartIdentifierSchema = typeof CommercetoolsCartIdentifierSchema,
  TCartPaginatedSearchResult extends
    AnyCartPaginatedSearchResult = typeof CartPaginatedSearchResultSchema,
> implements
    CartFactory<TCartSchema, TCartIdentifierSchema, TCartPaginatedSearchResult>
{
  public readonly cartSchema: TCartSchema;
  public readonly cartIdentifierSchema: TCartIdentifierSchema;
  public readonly cartPaginatedSearchResultSchema: TCartPaginatedSearchResult;

  constructor(
    cartSchema: TCartSchema,
    cartIdentifierSchema: TCartIdentifierSchema,
    cartPaginatedSearchResultSchema: TCartPaginatedSearchResult,
  ) {
    this.cartSchema = cartSchema;
    this.cartIdentifierSchema = cartIdentifierSchema;
    this.cartPaginatedSearchResultSchema = cartPaginatedSearchResultSchema;
  }

  public parseCartPaginatedSearchResult(
    _context: RequestContext,
    data: CartPagedQueryResponse,
    _query: CartQueryList,
  ): z.output<TCartPaginatedSearchResult> {
    const result = {
      pageNumber: _query.search.paginationOptions.pageNumber,
      pageSize: _query.search.paginationOptions.pageSize,
      totalCount: data.total || 0,
      totalPages: Math.ceil(
        (data.total || 0) / _query.search.paginationOptions.pageSize,
      ),
      items: data.results.map((cart) =>
        this.parseCartSearchResultItem(_context, cart),
      ),

      identifier: _query.search,
    } satisfies CartPaginatedSearchResult;

    return this.cartPaginatedSearchResultSchema.parse(result);
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: CTCart,
  ): z.output<TCartIdentifierSchema> {
    return this.cartIdentifierSchema.parse({
      key: data.id || '',
      version: data.version || 0,
      company: data.businessUnit ? { taxIdentifier: data.businessUnit.key } : undefined,
    } satisfies CommercetoolsCartIdentifier);
  }

  public parseCartSearchResultItem(
    context: RequestContext,
    data: CTCart,
  ): CartSearchResultItem {
    const identifier = this.parseCartIdentifier(context, data);

    const numItems = data.lineItems.length;
    const lastModifiedDate = data.lastModifiedAt;
    let company: CompanyIdentifier | undefined;
    if (data.businessUnit) {
      company = {
        taxIdentifier: data.businessUnit.key,
      };
    }

    const result = {
      identifier,
      userId: {
        userId: data.customerId || data.anonymousId || '???',
      },
      company: company,
      name: data.custom?.fields['name'] || '',
      numItems,
      lastModifiedDate,
    } satisfies CartSearchResultItem;

    return result;
  }

  public parseCart(
    context: RequestContext,
    data: CTCart,
  ): z.output<TCartSchema> {
    const identifier = this.parseCartIdentifier(context, data);

    let company: CompanyIdentifier | undefined;
    if (data.businessUnit) {
      company = {
        taxIdentifier: data.businessUnit.key,
      };
    }

    const items: CartItem[] = [];
    for (const lineItem of data.lineItems) {
      items.push(this.parseCartItem(lineItem));
    }

    const grandTotal = data.totalPrice.centAmount || 0;
    const shippingTotal = data.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = data.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      (data.discountOnTotalPrice?.discountedAmount.centAmount || 0) +
      items.reduce(
        (sum, item) => sum + (item.price.totalDiscount.value * 100 || 0),
        0,
      );
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

    const localeString = context.languageContext.locale || 'en';
    const appliedPromotions = [];
    if (data.discountCodes) {
      for (const promo of data.discountCodes) {
        appliedPromotions.push({
          code: promo.discountCode.obj?.code || '',
          isCouponCode: true,
          name: promo.discountCode.obj?.name?.[localeString] || '',
          description:
            promo.discountCode.obj?.description?.[localeString] || '',
        } satisfies Promotion);
      }
    }

    const result = {
      identifier,
      userId: {
        userId: '???',
      },
      company: company,
      name: data.custom?.fields['name'] || '',
      description: data.custom?.fields['description'] || '',
      price,
      items,
      appliedPromotions,
    } satisfies Cart;

    return this.cartSchema.parse(result);
  }

  protected parseCartItem(lineItem: LineItem): CartItem {
    const unitPrice = lineItem.price.value.centAmount;
    const totalPrice = lineItem.totalPrice.centAmount || 0;
    let itemDiscount = 0;

    // look, discounts are weird in commercetools.... i think the .price.discount only applies for embedded prices maybe?
    if (
      lineItem.discountedPricePerQuantity &&
      lineItem.discountedPricePerQuantity.length > 0
    ) {
      itemDiscount = lineItem.discountedPricePerQuantity.reduce(
        (sum, discPrQty) => {
          return (
            sum +
              discPrQty.quantity *
                discPrQty.discountedPrice?.includedDiscounts?.reduce(
                  (sum, discount) => sum + discount.discountedAmount.centAmount,
                  0,
                ) || 0
          );
        },
        0,
      );
    }

    const totalDiscount =
      (lineItem.price.discounted?.value.centAmount || 0) + itemDiscount;
    const unitDiscount = totalDiscount / lineItem.quantity;
    const currency =
      lineItem.price.value.currencyCode.toUpperCase() as Currency;

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
