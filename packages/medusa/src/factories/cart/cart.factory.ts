import type { StoreCart, StoreCartLineItem } from '@medusajs/types';
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
  type Promotion,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import { MedusaCartIdentifierSchema, type MedusaCartIdentifier } from '../../schema/medusa.schema.js';
import { parseMedusaCostBreakdown, parseMedusaItemPrice } from '../../utils/medusa-helpers.js';

export interface ParseMedusaCartPaginatedSearchResultInput {
  items: StoreCart[],
  totalCount: number,
}

export class MedusaCartFactory<
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



  public parseCartPaginatedSearchResult(
    _context: RequestContext,
    data: ParseMedusaCartPaginatedSearchResultInput,
    _query: CartQueryList,
  ): z.output<TCartPaginatedSearchResult> {
    const result = {
      identifier: _query.search,
      items: data.items.map((item) => this.parseCartSearchResultItem(_context, item)),
      totalCount: data.totalCount,
      pageNumber: _query.search.paginationOptions.pageNumber,
      pageSize: _query.search.paginationOptions.pageSize,
      totalPages: Math.ceil(data.totalCount / _query.search.paginationOptions.pageSize),
    } satisfies CartPaginatedSearchResult;
    return this.cartPaginatedSearchResultSchema.parse(result);
  }

  public parseCartSearchResultItem(
    _context: RequestContext,
    data: StoreCart,
  ): CartSearchResultItem {
    const result = {
      identifier: this.parseCartIdentifier(_context, data as StoreCart),
      numItems: (data as StoreCart).items?.length || 0,
      lastModifiedDate: new Date((data as StoreCart).updated_at!).toISOString(),
      user: {
        userId: data.customer_id || '???',
      },
      company: undefined,
      name: '' + ((data as StoreCart).metadata?.['name'] || ''),
    } satisfies CartSearchResultItem;
    return result;
  }

  public parseCart(context: RequestContext, data: StoreCart): z.output<TCartSchema> {

    const identifier = MedusaCartIdentifierSchema.parse({
      key: data.id,
      region_id: data.region_id,
    } satisfies MedusaCartIdentifier);

    const name = '' + (data.metadata?.['name'] || '');
    const description = '' + (data.metadata?.['description'] || '');

    const price = this.parseCostBreakdown(context, data);

    // Parse cart items
    const items = new Array<CartItem>();

    const allItems = data.items || [];
    allItems.sort((a, b) =>
      a.created_at && b.created_at
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : 0
    );
    for (const remoteItem of allItems) {
      items.push(this.parseCartItem(context, remoteItem, price.grandTotal.currency));
    }


    const appliedPromotions = [];
    if (data.promotions) {
      for (const promo of data.promotions) {

        const promotionName = promo.code;
        let promoDescription = '';
        if (promo.application_method?.type === 'percentage') {
          promoDescription = `-${promo.application_method.value}%`;
        }
        if (promo.application_method?.type === 'fixed') {
          promoDescription = `-${promo.application_method.value} ${price.grandTotal.currency}`;
        }
        appliedPromotions.push({
          code: promo.code || '',
          isCouponCode: promo.is_automatic ? false : true,
          name: promotionName || promoDescription,
          description: promoDescription
        } satisfies Promotion);
      }
    }

    const result = {
      identifier,
      name,
      description,
      price,
      items,
      appliedPromotions,
      user: {
        userId: data.customer_id || '???',
      },
    } satisfies Cart;

    return this.cartSchema.parse(result);
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: StoreCart,
  ): z.output<TCartIdentifierSchema> {

    const result = {
      key: data.id,
      region_id: data.region_id
    } as MedusaCartIdentifier;

    return this.cartIdentifierSchema.parse(result);
  }


    /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
    _context: RequestContext,
    remoteItem: StoreCartLineItem,
    currency: Currency
  ): ItemCostBreakdown {
    return parseMedusaItemPrice(remoteItem, currency);
  }

  /**
   * Extension point to control the parsing of the cost breakdown of a cart
   * @param remote
   * @returns
   */
  protected parseCostBreakdown(
    _context: RequestContext,
    remote: StoreCart
  ): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }

  /**
   * Extension point to control the parsing of a single cart item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseCartItem(
    context: RequestContext,
    remoteItem: StoreCartLineItem,
    currency: Currency
  ): CartItem {

    const item: CartItem = {
      identifier: {
        key: remoteItem.id,
      },
      product: {
        key: remoteItem.product_id || '',
      },
      variant: ProductVariantIdentifierSchema.parse({
        sku: remoteItem.variant_sku || '',
      } satisfies ProductVariantIdentifier),
      quantity: remoteItem.quantity || 1,
      price: this.parseItemPrice(context, remoteItem, currency),
    };
    return item;
  }

}
