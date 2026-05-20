import type * as z from 'zod';
import {
  type CartSchema,
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  type AnyCartSchema,
  type AnyCartIdentifierSchema,
  type AnyCartPaginatedSearchResult,
  type CartFactory,
  type RequestContext,
  type CartQueryList,
} from '@reactionary/core';
import type {
  HclWcsCartResponse,
  HclWcsOrderListResponse,
} from '../../schema/hcl.schema.js';

export class HclCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends
    AnyCartIdentifierSchema = typeof CartIdentifierSchema,
  TCartPaginatedSearchResult extends
    AnyCartPaginatedSearchResult = typeof CartPaginatedSearchResultSchema,
> implements
    CartFactory<TCartSchema, TCartIdentifierSchema, TCartPaginatedSearchResult>
{
  constructor(
    public readonly cartSchema: TCartSchema,
    public readonly cartIdentifierSchema: TCartIdentifierSchema = CartIdentifierSchema as unknown as TCartIdentifierSchema,
    public readonly cartPaginatedSearchResultSchema: TCartPaginatedSearchResult = CartPaginatedSearchResultSchema as unknown as TCartPaginatedSearchResult,
  ) {}

  parseCart(context: RequestContext, data: unknown): z.output<TCartSchema> {
    const cart = data as HclWcsCartResponse;
    const currency =
      cart.totalProductPriceCurrency ?? cart.grandTotalCurrency ?? 'USD';

    return this.cartSchema.parse({
      identifier: { key: cart.orderId },
      user: { userId: cart.buyerId ?? '' },
      company: cart.orgUniqueID ? { id: cart.orgUniqueID } : undefined,
      name:
        cart.orderDescription ??
        (context.session['hcl.cartName'] as string | undefined) ??
        '',
      description: '',
      items: (cart.orderItem ?? []).map((item) => ({
        identifier: { key: item.orderItemId },
        product: { key: item.productId ?? '' },
        variant: { sku: item.partNumber },
        quantity: Number(item.quantity),
        price: {
          unitPrice: {
            value: Number(item.unitPrice),
            currency: item.currency,
          },
          totalPrice: {
            value: Number(item.orderItemPrice),
            currency: item.currency,
          },
          unitDiscount: { value: 0, currency: item.currency },
          totalDiscount: { value: 0, currency: item.currency },
        },
      })),
      price: {
        grandTotal: {
          value: Number(cart.grandTotal ?? '0'),
          currency,
        },
        totalProductPrice: {
          value: Number(cart.totalProductPrice ?? '0'),
          currency,
        },
        totalShipping: {
          value: Number(cart.totalShippingCharge ?? '0'),
          currency,
        },
        totalTax: {
          value: Number(cart.totalSalesTax ?? '0'),
          currency,
        },
        totalDiscount: {
          value: Math.abs(Number(cart.totalAdjustment ?? '0')),
          currency,
        },
        totalSurcharge: { value: 0, currency },
      },
      appliedPromotions: (cart.adjustment ?? [])
        .filter((adj) => adj.usage === 'Discount')
        .map((adj) => ({
          code: adj.code,
          isCouponCode: (cart.promotionCode ?? []).some(
            (pc) => pc.code === adj.code,
          ),
          name: adj.description ?? adj.code,
          description: adj.description ?? '',
          amount: {
            value: Math.abs(Number(adj.amount)),
            currency: adj.currency,
          },
        })),
    }) as z.output<TCartSchema>;
  }

  parseCartIdentifier(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCartIdentifierSchema> {
    const cart = data as HclWcsCartResponse;
    return this.cartIdentifierSchema.parse({
      key: cart.orderId,
    }) as z.output<TCartIdentifierSchema>;
  }

  parseCartPaginatedSearchResult(
    context: RequestContext,
    data: unknown,
    _query: CartQueryList,
  ): z.output<TCartPaginatedSearchResult> {
    const pageSize = _query.search.paginationOptions.pageSize;
    const pageNumber = _query.search.paginationOptions.pageNumber;

    // Handle order list response from GET /order/byStatus/P.
    const orderList = data as Partial<HclWcsOrderListResponse>;
    if (Array.isArray(orderList.Order)) {
      const orders = orderList.Order;
      const total = Number(orderList.recordSetTotal ?? orders.length);
      const items = orders.map((order) => {
        const parsed = this.parseCart(context, order);
        return {
          ...parsed,
          numItems: (order.orderItem ?? []).length,
          lastModifiedDate: order.lastUpdateDate ?? '',
        };
      });
      return this.cartPaginatedSearchResultSchema.parse({
        identifier: _query.search,
        items,
        totalCount: total,
        totalPages: Math.ceil(total / Math.max(1, pageSize)),
        pageSize,
        pageNumber,
      }) as z.output<TCartPaginatedSearchResult>;
    }

    // Single cart response from GET /cart/@self or GET /order/{orderId}.
    const cart = data as HclWcsCartResponse;

    // Empty orderId signals no active cart — return empty result.
    if (!cart.orderId) {
      return this.cartPaginatedSearchResultSchema.parse({
        identifier: _query.search,
        items: [],
        totalCount: 0,
        totalPages: 0,
        pageSize,
        pageNumber,
      }) as z.output<TCartPaginatedSearchResult>;
    }

    const parsedCart = this.parseCart(context, cart);

    return this.cartPaginatedSearchResultSchema.parse({
      identifier: _query.search,
      items: [
        {
          ...parsedCart,
          numItems: (cart.orderItem ?? []).length,
          lastModifiedDate: cart.lastUpdateDate ?? '',
        },
      ],
      totalCount: 1,
      totalPages: 1,
      pageSize,
      pageNumber,
    }) as z.output<TCartPaginatedSearchResult>;
  }
}
