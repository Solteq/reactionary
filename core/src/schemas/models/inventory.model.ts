import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { InventoryIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const InventorySchema = BaseModelSchema.extend({
    identifier: InventoryIdentifierSchema,
    quantity: z.number(),
    status: z.enum(['inStock', 'outOfStock', 'onBackOrder', 'preOrder', 'discontinued']),
});

export type Inventory = InferType<typeof InventorySchema>;
