import type {
  AnyInventorySchema,
  Inventory,
  InventoryFactory,
  InventoryIdentifier,
  InventorySchema,
  InventoryStatus,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaInventoryParseInput {
  sku: string;
  fulfillmentCenterKey: string;
  quantity: number;
  inventoryItemId: string;
}

export class MedusaInventoryFactory<
  TInventorySchema extends AnyInventorySchema = typeof InventorySchema,
> implements InventoryFactory<TInventorySchema>
{
  public readonly inventorySchema: TInventorySchema;

  constructor(inventorySchema: TInventorySchema) {
    this.inventorySchema = inventorySchema;
  }

  public parseInventory(
    _context: RequestContext,
    data: MedusaInventoryParseInput,
  ): z.output<TInventorySchema> {
    const { sku, fulfillmentCenterKey, quantity } = data;

    const identifier = {
      variant: {
        sku,
      },
      fulfillmentCenter: {
        key: fulfillmentCenterKey,
      },
    } satisfies InventoryIdentifier;

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
