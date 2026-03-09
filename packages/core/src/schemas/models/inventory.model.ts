import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { InventoryIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const InventoryStatusSchema = z.enum(['inStock', 'outOfStock', 'onBackOrder', 'preOrder', 'discontinued']);

export const InventorySchema = BaseModelSchema.extend({
    identifier: InventoryIdentifierSchema,
    quantity: z.number(),
    status: InventoryStatusSchema,
});

export type InventoryStatus = InferType<typeof InventoryStatusSchema>;
export type Inventory = InferType<typeof InventorySchema>;
