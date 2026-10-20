import {
  CurrencySchema,
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
import { MagentoCartIdentifierSchema, type MagentoCartIdentifier } from '../../schema/magento.schema.js';
import type { MagentoCart, MagentoCartItem } from '../../schema/magento.types.js';
import type { MagentoCartData } from '../../schema/cart.types.js';


export interface MagentoCartFactoryPaginatedSearchResultInput {
  items: MagentoCartData[];
  totalCount: number;
}

/**
 * The key a cart is addressed by. A guest quote can only be reached through
 * its masked id (the numeric id is not accepted on `guest-carts`), so the
 * masked id wins, then the masked id the caller asked for. A customer quote
 * is reached through `carts/mine` and keyed by its numeric id, also when the
 * caller still holds a guest key from before signing in.
 */
export function resolveMagentoCartKey(data: MagentoCart): string {
  if (data.masked_id) {
    return data.masked_id;
  }
  const isCustomerQuote = typeof data.customer?.id === 'number';
  if (!isCustomerQuote && data._requestedId) {
    return data._requestedId;
  }
  if (typeof data.id === 'number') {
    return String(data.id);
  }
  return data._requestedId ?? '';
}

/**
 * `extension_attributes` keys under which an extension may expose the parent
 * (configurable) product of a cart item. Native Magento does not return the
 * parent on cart items; the child SKU is all it gives.
 */
const PARENT_PRODUCT_KEY_ATTRIBUTES = [
  'parent_product_key',
  'parent_external_id',
  'parent_sku',
] as const;

/** Total segment codes of payment-fee / surcharge modules. */
const SURCHARGE_SEGMENT_PATTERN = /fee|surcharge/i;

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
    data: MagentoCartData,
  ): z.output<TCartSchema> {
    const currency = this.resolveCurrency(data);

    const cost = this.parseCostBreakdown(data, currency);
    const items = (data.items || [])
      .map((item) => this.parseCartItem(item, currency));

    const result = {
      identifier: {
        key: resolveMagentoCartKey(data),
      },
      user: {
        userId: String(data.customer?.id || ''),
      },
      company: data._company,
      items,
      price: cost,
      appliedPromotions: this.parseAppliedPromotions(data, currency),
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
      key: resolveMagentoCartKey(data),
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

  protected parseCartSearchResultItem(context: RequestContext, data: MagentoCartData): CartSearchResultItem {
    const cart = this.parseCart(context, data);
    return {
      identifier: cart.identifier,
      user: cart.user,
      company: cart.company,
      numItems: cart.items.length,
      name: cart.name,
      lastModifiedDate: data.updated_at ?? '',
    } satisfies CartSearchResultItem;
  }

  /**
   * The quote currency: from the merged totals, else the cart's `currency`
   * block (the REST cart carries it there).
   */
  protected resolveCurrency(data: MagentoCartData): Currency {
    const parsed = CurrencySchema.safeParse(
      data.quote_currency_code || data.currency?.quote_currency_code,
    );
    return parsed.success ? parsed.data : 'USD';
  }

  /**
   * Magento reports cart price rules as one aggregated `discount` segment
   * ("Discount (CODE, Rule label)") and the applied coupon as `coupon_code`.
   * A coupon yields one coupon promotion carrying the total discount; a
   * discount without a coupon (automatic rules) yields one non-coupon
   * promotion named after the segment title.
   */
  protected parseAppliedPromotions(data: MagentoCartData, currency: Currency): Promotion[] {
    const segment = data.total_segments?.find((s) => s.code === 'discount');
    const discount = Math.abs(segment?.value ?? data.discount_amount ?? 0);
    const amount = discount > 0 ? { value: discount, currency } : undefined;

    if (data.coupon_code) {
      return [
        {
          code: data.coupon_code,
          isCouponCode: true,
          name: data.coupon_code,
          description: segment?.title ?? '',
          amount,
        },
      ];
    }

    if (amount) {
      return [
        {
          code: '',
          isCouponCode: false,
          name: segment?.title || 'Discount',
          description: '',
          amount,
        },
      ];
    }

    return [];
  }

  /** Sums the totals segments of payment-fee / surcharge modules, if any. */
  protected parseSurcharge(data: MagentoCartData): number {
    return (data.total_segments ?? [])
      .filter((s) => SURCHARGE_SEGMENT_PATTERN.test(s.code))
      .reduce((sum, s) => sum + (s.value ?? 0), 0);
  }

  protected parseCostBreakdown(cart: MagentoCartData, currency: Currency): CostBreakDown {
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
        value: this.parseSurcharge(cart),
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

  /**
   * The product (not variant) key of a cart item. Magento returns the child
   * SKU on a configurable item and no parent reference, so the parent key is
   * used when an extension exposes it in `extension_attributes`; otherwise the
   * SKU stands in.
   */
  protected resolveProductKey(item: MagentoCartItem): string {
    const attributes = item.extension_attributes ?? {};
    for (const name of PARENT_PRODUCT_KEY_ATTRIBUTES) {
      const value = attributes[name];
      if (typeof value === 'string' && value !== '') {
        return value;
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return item.sku;
  }

  protected parseCartItem(item: MagentoCartItem, currency: Currency): CartItem {
    return {
      identifier: {
        key: String(item.item_id),
      },
      product: {
        key: this.resolveProductKey(item),
      },
      variant: ProductVariantIdentifierSchema.parse({
        sku: item.sku,
      } satisfies ProductVariantIdentifier),
      quantity: item.qty,
      price: this.parseItemPrice(item, currency),
    } satisfies CartItem;
  }
}
