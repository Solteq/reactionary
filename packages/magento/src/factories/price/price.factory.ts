import {
  CurrencySchema,
  type AnyPriceSchema,
  type Currency,
  type MonetaryAmount,
  type Price,
  type PriceFactory,
  type PriceIdentifier,
  type PriceSchema,
  type RequestContext,
  type TieredPrice,
} from '@reactionary/core';
import * as z from 'zod';
import type { MagentoProduct } from '../../schema/magento.types.js';

/** Magento's built-in "NOT LOGGED IN" customer group. */
export const MAGENTO_NOT_LOGGED_IN_GROUP_ID = 0;
/** The pseudo group id Magento uses for tier prices that apply to all groups. */
export const MAGENTO_ALL_GROUPS_ID = 32000;

export interface MagentoPriceParseInput {
  product: MagentoProduct;
  sku: string;
  mode: 'list' | 'customer';
  /**
   * The customer group whose tier prices apply. Tiers of other groups are
   * ignored; "ALL GROUPS" tiers always apply. Defaults to NOT LOGGED IN.
   */
  customerGroupId?: number;
  /** The currency the catalog prices are kept in (the store's base currency). */
  currency?: Currency;
  /** The moment special-price dates are evaluated against. Defaults to now. */
  now?: Date;
}

const MagentoTierPriceInputSchema = z.looseObject({
  customer_group_id: z.number(),
  qty: z.number(),
  value: z.number(),
  extension_attributes: z
    .looseObject({ percentage_value: z.number().nullish() })
    .optional(),
});

const MagentoPriceParseInputSchema = z.object({
  product: z.looseObject({
    price: z.number().nullish(),
    custom_attributes: z
      .array(z.looseObject({ attribute_code: z.string(), value: z.unknown() }))
      .optional(),
    tier_prices: z.array(MagentoTierPriceInputSchema).optional(),
  }),
  sku: z.string(),
  mode: z.enum(['list', 'customer']),
  customerGroupId: z.number().optional(),
  currency: CurrencySchema.optional(),
  now: z.date().optional(),
});

type ParsedProduct = z.output<typeof MagentoPriceParseInputSchema>['product'];

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAttribute(product: ParsedProduct, code: string): unknown {
  return product.custom_attributes?.find((a) => a.attribute_code === code)
    ?.value;
}

/**
 * Magento keeps special-price dates as "YYYY-MM-DD HH:MM:SS" and applies them
 * by calendar day: from the start of `special_from_date` to the end of
 * `special_to_date` (evaluated in UTC here, Magento uses the store timezone).
 */
function parseDay(value: unknown, endOfDay: boolean): Date | undefined {
  if (typeof value !== 'string' || value.length < 10) {
    return undefined;
  }
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** The special price when one is set and active at `now`, else undefined. */
function getActiveSpecialPrice(
  product: ParsedProduct,
  now: Date,
): number | undefined {
  const raw = getAttribute(product, 'special_price');
  if (raw === null || raw === undefined || raw === '') {
    return undefined;
  }
  const special = Number(raw);
  if (!Number.isFinite(special)) {
    return undefined;
  }

  const from = parseDay(getAttribute(product, 'special_from_date'), false);
  const to = parseDay(getAttribute(product, 'special_to_date'), true);
  if (from && now < from) {
    return undefined;
  }
  if (to && now > to) {
    return undefined;
  }
  return special;
}

/**
 * The tier prices that apply to `customerGroupId` (plus "ALL GROUPS"), with
 * percentage tiers resolved against the regular price, keeping the lowest
 * price per quantity.
 */
function getApplicableTiers(
  product: ParsedProduct,
  customerGroupId: number,
  regularPrice: number,
): Array<{ qty: number; value: number }> {
  const byQty = new Map<number, number>();
  for (const tier of product.tier_prices ?? []) {
    if (
      tier.customer_group_id !== customerGroupId &&
      tier.customer_group_id !== MAGENTO_ALL_GROUPS_ID
    ) {
      continue;
    }
    const percentage = tier.extension_attributes?.percentage_value;
    const value =
      typeof percentage === 'number'
        ? roundPrice(regularPrice * (1 - percentage / 100))
        : tier.value;
    const current = byQty.get(tier.qty);
    if (current === undefined || value < current) {
      byQty.set(tier.qty, value);
    }
  }
  return [...byQty.entries()]
    .map(([qty, value]) => ({ qty, value }))
    .sort((a, b) => a.qty - b.qty);
}

/**
 * Maps a catalog (REST) product onto a core price.
 *
 * - `list`: the regular `price`, never on sale.
 * - `customer`: the lowest of the regular price, the special price (when
 *   within its date range) and the group's quantity-1 tier price (which is
 *   also where B2B shared-catalog prices live). `onSale` is true when the
 *   active special price is what brings the price below the regular price.
 *
 * In both modes `tieredPrices` lists the group's (and ALL GROUPS') quantity
 * tiers above 1 that undercut the unit price. Catalog price rules are not
 * part of the REST product and are therefore not reflected.
 */
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
    const input = MagentoPriceParseInputSchema.parse(data);
    const { product, sku, mode } = input;
    const currency = input.currency ?? context.languageContext.currencyCode;
    const customerGroupId =
      input.customerGroupId ?? MAGENTO_NOT_LOGGED_IN_GROUP_ID;
    const now = input.now ?? new Date();

    const identifier = {
      variant: { sku },
    } satisfies PriceIdentifier;

    const regularPrice = product.price ?? 0;
    const tiers = getApplicableTiers(product, customerGroupId, regularPrice);

    let unitValue = regularPrice;
    let onSale = false;
    if (mode === 'customer') {
      const special = getActiveSpecialPrice(product, now);
      const baseTier = tiers
        .filter((tier) => tier.qty <= 1)
        .reduce<number | undefined>(
          (lowest, tier) =>
            lowest === undefined || tier.value < lowest ? tier.value : lowest,
          undefined,
        );

      unitValue = Math.min(
        regularPrice,
        special ?? Number.POSITIVE_INFINITY,
        baseTier ?? Number.POSITIVE_INFINITY,
      );
      onSale =
        special !== undefined &&
        special < regularPrice &&
        special <= unitValue;
    }

    const unitPrice = {
      value: unitValue,
      currency,
    } satisfies MonetaryAmount;

    const tieredPrices: TieredPrice[] = tiers
      .filter((tier) => tier.qty > 1 && tier.value < unitValue)
      .map((tier) => ({
        minimumQuantity: tier.qty,
        price: { value: tier.value, currency },
      }));

    const result = {
      identifier,
      unitPrice,
      onSale,
      tieredPrices,
    } satisfies Price;

    return this.priceSchema.parse(result);
  }
}
