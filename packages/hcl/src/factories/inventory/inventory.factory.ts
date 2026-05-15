import type {
  InventorySchema,
  AnyInventorySchema,
  Inventory,
  InventoryFactory,
  InventoryIdentifier,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclInventoryAvailabilityItem } from '../../schema/hcl.schema.js';

const HCL_STATUS_AVAILABLE = 'Available';

/**
 * Input shape for HclInventoryFactory.parseInventory.
 * Bundles the WCS response item with request context needed to build the identifier.
 */
export interface HclInventoryFactoryInput {
  /** One entry from InventoryAvailability[] in the WCS response. */
  item: HclInventoryAvailabilityItem;
  /** The requested part number / SKU (from the getBySKU payload). */
  sku: string;
  /** The requested fulfilment center key. Empty string means online inventory. */
  fulfilmentCenterKey: string;
}

export class HclInventoryFactory<
  TSchema extends AnyInventorySchema = typeof InventorySchema,
> implements InventoryFactory<TSchema>
{
  public readonly inventorySchema: TSchema;

  constructor(inventorySchema: TSchema) {
    this.inventorySchema = inventorySchema;
  }

  /**
   * Map an HclInventoryAvailabilityItem to an Inventory model.
   * The `data.sku` is used for the identifier since WCS items carry only an
   * internal `productId`, not the human-readable part number.
   */
  parseInventory(
    _context: RequestContext,
    data: HclInventoryFactoryInput,
  ): z.output<TSchema> {
    const { item, sku, fulfilmentCenterKey } = data;
    const identifier: InventoryIdentifier = {
      variant: { sku },
      fulfillmentCenter: { key: fulfilmentCenterKey || 'online' },
    };
    return this.inventorySchema.parse({
      identifier,
      quantity: Number(item.availableQuantity ?? '0'),
      status:
        item.inventoryStatus === HCL_STATUS_AVAILABLE
          ? 'inStock'
          : 'outOfStock',
    }) as z.output<TSchema>;
  }

  /** Create an empty (out-of-stock) inventory when no matching record was found. */
  createEmpty(sku: string, fulfilmentCenterKey: string): z.output<TSchema> {
    return this.inventorySchema.parse({
      identifier: {
        variant: { sku },
        fulfillmentCenter: { key: fulfilmentCenterKey || 'online' },
      },
      quantity: 0,
      status: 'outOfStock',
    }) as z.output<TSchema>;
  }
}

export type AnyHclInventorySchema = AnyInventorySchema;
export type HclInventoryFactoryOutput<T extends InventoryFactory> =
  T extends HclInventoryFactory<infer TSchema> ? z.output<TSchema> : Inventory;
