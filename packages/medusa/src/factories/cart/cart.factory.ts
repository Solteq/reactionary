import type { StoreCart, StoreCartLineItem } from '@medusajs/types';
import {
  ProductVariantIdentifierSchema,
  type AnyCartIdentifierSchema,
  type AnyCartSchema,
  type Cart,
  type CartFactory,
  type CartIdentifierSchema,
  type CartItem,
  type CartSchema,
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

export class MedusaCartFactory<
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
      userId: {
        userId: '???',
      },
    } satisfies Cart;

    return this.cartSchema.parse(result);
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCartIdentifierSchema> {
    return this.cartIdentifierSchema.parse(data);
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
