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

export interface MagentoInventoryParseInput {
  sku: string;
  fulfillmentCenterKey: string;
  quantity: number;
  status: 'inStock' | 'outOfStock';
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
    const input = data as MagentoInventoryParseInput;
    const { sku, fulfillmentCenterKey, quantity } = input;

    const identifier = {
      variant: { sku },
      fulfillmentCenter: { key: fulfillmentCenterKey },
    } satisfies InventoryIdentifier;

    const status: InventoryStatus = quantity > 0 ? 'inStock' : 'outOfStock';

    const result = {
      identifier,
      quantity,
      status,
    } satisfies Inventory;

    return this.inventorySchema.parse(result);
  }
}
