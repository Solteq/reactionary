import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { FulfillmentCenterIdentifierSchema, ProductIdentifierSchema } from '../models/identifiers.model.js';

export const InventoryQueryBySKUSchema = BaseQuerySchema.extend({
    sku: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})).nonoptional(),
    fulfilmentCenter: FulfillmentCenterIdentifierSchema.default(() => FulfillmentCenterIdentifierSchema.parse({})).nonoptional()
});

//export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type InventoryQueryBySKU = z.infer<typeof InventoryQueryBySKUSchema>;
