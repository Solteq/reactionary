import type {
  AnyInventorySchema,
  InventoryFactory,
  InventorySchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeInventoryFactory<
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
    return this.inventorySchema.parse(data);
  }
}
