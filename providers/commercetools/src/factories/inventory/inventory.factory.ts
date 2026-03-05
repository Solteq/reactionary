import type { InventoryEntry } from '@commercetools/platform-sdk';
import type {
  InventorySchema} from '@reactionary/core';
import {
  type AnyInventorySchema,
  type Inventory,
  type InventoryFactory,
  type InventoryIdentifier,
  type InventoryStatus,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsInventoryFactory<
  TInventorySchema extends AnyInventorySchema = typeof InventorySchema,
> implements InventoryFactory<TInventorySchema>
{
  public readonly inventorySchema: TInventorySchema;

  constructor(inventorySchema: TInventorySchema) {
    this.inventorySchema = inventorySchema;
  }

  public parseInventory(
    _context: RequestContext,
    data: InventoryEntry,
  ): z.output<TInventorySchema> {
    const identifier = {
      variant: { sku: data.sku || '' },
      fulfillmentCenter: {
        key: data.supplyChannel?.obj?.key || '',
      },
    } satisfies InventoryIdentifier;

    const quantity = data.availableQuantity || 0;
    let status: InventoryStatus = 'outOfStock';
    if (quantity > 0) {
      status = 'inStock';
    }

    const result = {
      identifier,
      quantity,
      status,
    } satisfies Inventory;

    return this.inventorySchema.parse(result);
  }
}
