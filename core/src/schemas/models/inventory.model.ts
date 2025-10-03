import { z } from 'zod';
import { BaseModelSchema } from './base.model';
import { InventoryIdentifierSchema } from './identifiers.model';

export const InventorySchema = BaseModelSchema.extend({
    identifier: InventoryIdentifierSchema.default(() => InventoryIdentifierSchema.parse({})),
    sku: z.string().default(''),
    quantity: z.number().default(0),
    status: z.enum(['inStock', 'outOfStock', 'onBackOrder', 'preOrder', 'discontinued']).default('inStock'),
});

export type Inventory = z.infer<typeof InventorySchema>;
