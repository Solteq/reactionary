import {
  ProductVariantIdentifierSchema,
  type AnyCartIdentifierSchema,
  type AnyCartPaginatedSearchResult,
  type AnyCartSchema,
  type Cart,
  type CartFactory,
  type CartIdentifierSchema,
  type CartItem,
  type CartPaginatedSearchResult,
  type CartPaginatedSearchResultSchema,
  type CartQueryList,
  type CartSchema,
  type CartSearchResultItem,
  type CostBreakDown,
  type Currency,
  type ItemCostBreakdown,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import { MagentoCartIdentifierSchema, type MagentoCartIdentifier } from '../../schema/magento.schema.js';
import type { MagentoCart, MagentoCartItem } from '../../schema/magento.types.js';


export interface MagentoCartFactoryPaginatedSearchResultInput {
  items: MagentoCart[];
  totalCount: number;
}

export class MagentoCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = typeof CartIdentifierSchema,
  TCartPaginatedSearchResult extends AnyCartPaginatedSearchResult = typeof CartPaginatedSearchResultSchema,
> implements CartFactory<TCartSchema, TCartIdentifierSchema, TCartPaginatedSearchResult>
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

  public parseCart(
    _context: RequestContext,
    data: MagentoCart,
  ): z.output<TCartSchema> {
    const requestedId = data._requestedId;
    const currency = (data.quote_currency_code || 'USD') as Currency;

    const cost = this.parseCostBreakdown(data, currency);
    const items = (data.items || [])
      .map((item) => this.parseCartItem(item, currency));

    let identifierKey = data.masked_id;
    if (!identifierKey && requestedId && isNaN(Number(requestedId))) {
      identifierKey = requestedId;
    }
    if (!identifierKey) {
      identifierKey = String(data.id || '');
    }

    const result = {
      identifier: {
        key: String(identifierKey || ''),
      },
      user: {
        userId: String(data.customer?.id || ''),
      },
      items,
      price: cost,
      appliedPromotions: [],
      name: data.name || '',
      description: data.description || '',
    } satisfies Cart;

    return this.cartSchema.parse(result);
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: MagentoCart,
  ): z.output<TCartIdentifierSchema> {
    const result = MagentoCartIdentifierSchema.parse({
      key: String(data.id || data.masked_id || ''),
    } satisfies MagentoCartIdentifier);

    return this.cartIdentifierSchema.parse(result);
  }

  public parseCartPaginatedSearchResult(
    _context: RequestContext,
    data: MagentoCartFactoryPaginatedSearchResultInput,
    query: CartQueryList,
  ): z.output<TCartPaginatedSearchResult> {
    const result = {
      identifier: query.search,
      items: data.items.map((item) => this.parseCartSearchResultItem(_context, item)),
      totalCount: data.totalCount,
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalPages: Math.ceil(data.totalCount / query.search.paginationOptions.pageSize),
    } satisfies CartPaginatedSearchResult;

    return this.cartPaginatedSearchResultSchema.parse(result);
  }

  protected parseCartSearchResultItem(context: RequestContext, data: MagentoCart): CartSearchResultItem {
    const cart = this.parseCart(context, data);
    return {
      identifier: cart.identifier,
      user: cart.user,
      numItems: cart.items.length,
      name: cart.name,
      lastModifiedDate: data.updated_at ?? '',
    } satisfies CartSearchResultItem;
  }

  protected parseCostBreakdown(cart: MagentoCart, currency: Currency): CostBreakDown {
    return {
      totalProductPrice: {
        value: cart.subtotal ?? cart.base_subtotal ?? 0,
        currency,
      },
      grandTotal: {
        value: cart.grand_total ?? cart.base_grand_total ?? 0,
        currency,
      },
      totalTax: {
        value: cart.tax_amount ?? cart.base_tax_amount ?? 0,
        currency,
      },
      totalShipping: {
        value: cart.shipping_amount ?? cart.base_shipping_amount ?? 0,
        currency,
      },
      totalDiscount: {
        value: Math.abs(cart.discount_amount ?? cart.base_discount_amount ?? 0),
        currency,
      },
      totalSurcharge: {
        value: 0,
        currency,
      },
    } satisfies CostBreakDown;
  }

  protected parseItemPrice(item: MagentoCartItem, currency: Currency): ItemCostBreakdown {
    const qty = item.qty ?? 0;
    return {
      unitPrice: {
        value: item.price ?? 0,
        currency,
      },
      unitDiscount: {
        value: item.discount_amount ? Math.abs(item.discount_amount / (qty || 1)) : 0,
        currency,
      },
      totalPrice: {
        value: item.row_total !== undefined
          ? item.row_total
          : ((item.price || 0) * (qty || 0)),
        currency,
      },
      totalDiscount: {
        value: Math.abs(item.discount_amount || 0),
        currency,
      },
    } satisfies ItemCostBreakdown;
  }

  protected parseCartItem(item: MagentoCartItem, currency: Currency): CartItem {
    return {
      identifier: {
        key: String(item.item_id),
      },
      product: {
        key: item.sku,
      },
      variant: ProductVariantIdentifierSchema.parse({
        sku: item.sku,
      } satisfies ProductVariantIdentifier),
      quantity: item.qty,
      price: this.parseItemPrice(item, currency),
    } satisfies CartItem;
  }
}
