import type {
  PriceSchema,
  AnyPriceSchema,
  Price,
  PriceFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  HclDisplayPriceItem,
  HclEntitledPriceItem,
} from '../../schema/hcl.schema.js';

/**
 * Input shape for HclPriceFactory.parsePrice.
 * Accepts items from either the /price (EntitledPrice) or /display_price (resultList) endpoints.
 * The `item.partNumber` is used as the variant SKU identifier.
 */
export interface HclPriceFactoryInput {
  item: HclEntitledPriceItem | HclDisplayPriceItem;
}

export class HclPriceFactory<
  TSchema extends AnyPriceSchema = typeof PriceSchema,
> implements PriceFactory<TSchema>
{
  public readonly priceSchema: TSchema;

  constructor(priceSchema: TSchema) {
    this.priceSchema = priceSchema;
  }

  /**
   * Map a price response item to a Price model.
   * Supports both /price (EntitledPrice with capital `UnitPrice`) and
   * /display_price (resultList with lowercase `unitPrice`) response shapes.
   * The `item.partNumber` is used as the variant SKU identifier.
   */
  parsePrice(
    _context: RequestContext,
    data: HclPriceFactoryInput,
  ): z.output<TSchema> {
    const { item } = data;
    // /price endpoint uses `UnitPrice` (capital U); /display_price uses `unitPrice`.
    const entitledItem = item as HclEntitledPriceItem;
    const displayItem = item as HclDisplayPriceItem;
    const priceEntry =
      entitledItem.UnitPrice?.[0]?.price ?? displayItem.unitPrice?.[0]?.price;

    return this.priceSchema.parse({
      identifier: { variant: { sku: item.partNumber ?? '' } },
      unitPrice: {
        value: priceEntry?.value ?? -1,
        currency: priceEntry?.currency ?? '',
      },
      onSale: false,
      tieredPrices: [],
    }) as z.output<TSchema>;
  }

  /** Create an empty (placeholder) price when no result was found for a SKU. */
  createEmpty(sku: string, currency: string): z.output<TSchema> {
    return this.priceSchema.parse({
      identifier: { variant: { sku } },
      unitPrice: { value: -1, currency },
      onSale: false,
      tieredPrices: [],
    }) as z.output<TSchema>;
  }
}

export type AnyHclPriceSchema = AnyPriceSchema;
export type HclPriceFactoryOutput<T extends PriceFactory> =
  T extends HclPriceFactory<infer TSchema> ? z.output<TSchema> : Price;
