import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { FulfillmentCenterIdentifierSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';

export const InventoryQueryBySKUSchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})).describe('The unique identifier for the product variant (SKU).'),
    fulfilmentCenter: FulfillmentCenterIdentifierSchema.default(() => FulfillmentCenterIdentifierSchema.parse({})).nonoptional()
});

//export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type InventoryQueryBySKU = z.infer<typeof InventoryQueryBySKUSchema>;
