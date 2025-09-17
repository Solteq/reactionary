import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { ProductIdentifier, ProductIdentifierSchema } from '../models/identifiers.model';

export const InventoryQueryBySKUSchema = BaseQuerySchema.extend({
    query: z.literal('sku'),
    sku: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
});

export const InventoryQuerySchema = z.union([InventoryQueryBySKUSchema]);



//export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type InventoryQueryBySKU = z.infer<typeof InventoryQueryBySKUSchema>;

export interface  InventoryQueries {
  "sku": { sku: ProductIdentifier }
};

export type InventoryQuery = {
  [K in keyof InventoryQueries]: { type: K } & InventoryQueries[K];
}[keyof InventoryQueries];
