import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { InventoryIdentifierSchema } from './identifiers.model.js';

export const InventorySchema = BaseModelSchema.extend({
    identifier: InventoryIdentifierSchema.default(() => InventoryIdentifierSchema.parse({})),
    sku: z.string().default(''),
    quantity: z.number().default(0),
    status: z.enum(['inStock', 'outOfStock', 'onBackOrder', 'preOrder', 'discontinued']).default('inStock'),
});

export type Inventory = z.infer<typeof InventorySchema>;
