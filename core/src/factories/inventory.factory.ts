import type * as z from 'zod';
import type { InventorySchema } from '../schemas/models/inventory.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyInventorySchema = z.ZodType<z.output<typeof InventorySchema>>;

export interface InventoryFactory<
  TInventorySchema extends AnyInventorySchema = AnyInventorySchema,
> {
  inventorySchema: TInventorySchema;
  parseInventory(context: RequestContext, data: unknown): z.output<TInventorySchema>;
}

export type InventoryFactoryOutput<TFactory extends InventoryFactory> = ReturnType<
  TFactory['parseInventory']
>;

export type InventoryFactoryWithOutput<TFactory extends InventoryFactory> = Omit<
  TFactory,
  'parseInventory'
> & {
  parseInventory(
    context: RequestContext,
    data: unknown,
  ): InventoryFactoryOutput<TFactory>;
};
