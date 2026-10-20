import {
  InventoryStatusSchema,
  type AnyInventorySchema,
  type Inventory,
  type InventoryFactory,
  type InventoryIdentifier,
  type InventorySchema,
  type InventoryStatus,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';

/** What the inventory capability hands the factory. */
export const MagentoInventoryParseInputSchema = z.object({
  sku: z.string(),
  fulfillmentCenterKey: z.string(),
  quantity: z.number(),
  /**
   * The status the capability derived from Magento's stock flags and
   * backorder setting. When omitted it is derived from `quantity` alone.
   */
  status: InventoryStatusSchema.optional(),
});

export type MagentoInventoryParseInput = z.input<
  typeof MagentoInventoryParseInputSchema
>;

/**
 * Maps Magento's stock flags onto a core inventory status:
 * - in stock with quantity on hand → `inStock`;
 * - in stock without quantity but with backorders enabled → `onBackOrder`;
 * - in stock without quantity and without backorders → `outOfStock`
 *   (Magento keeps such items "in stock" only when stock is not managed, in
 *   which case `manageStock` should be passed as false);
 * - out of stock → `outOfStock`.
 */
export function resolveMagentoInventoryStatus(input: {
  isInStock: boolean;
  quantity: number;
  backorders?: number;
  manageStock?: boolean;
}): InventoryStatus {
  if (!input.isInStock) {
    return 'outOfStock';
  }
  if (input.quantity > 0 || input.manageStock === false) {
    return 'inStock';
  }
  if ((input.backorders ?? 0) > 0) {
    return 'onBackOrder';
  }
  return 'outOfStock';
}

export class MagentoInventoryFactory<
  TInventorySchema extends AnyInventorySchema = typeof InventorySchema,
> implements InventoryFactory<TInventorySchema>
{
  public readonly inventorySchema: TInventorySchema;

  constructor(inventorySchema: TInventorySchema) {
    this.inventorySchema = inventorySchema;
  }

  public parseInventory(
    _context: RequestContext,
    data: unknown,
  ): z.output<TInventorySchema> {
    const { sku, fulfillmentCenterKey, quantity, status } =
      MagentoInventoryParseInputSchema.parse(data);

    const identifier = {
      variant: { sku },
      fulfillmentCenter: { key: fulfillmentCenterKey },
    } satisfies InventoryIdentifier;

    const result = {
      identifier,
      quantity,
      status: status ?? (quantity > 0 ? 'inStock' : 'outOfStock'),
    } satisfies Inventory;

    return this.inventorySchema.parse(result);
  }
}
