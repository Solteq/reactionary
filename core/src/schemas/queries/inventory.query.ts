import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { FulfillmentCenterIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const InventoryQueryBySKUSchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.describe('The unique identifier for the product variant (SKU).'),
    fulfilmentCenter: FulfillmentCenterIdentifierSchema
});

export type InventoryQueryBySKU = InferType<typeof InventoryQueryBySKUSchema>;
