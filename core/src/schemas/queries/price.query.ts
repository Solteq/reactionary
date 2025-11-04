import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { ProductVariantIdentifierSchema } from '../models/identifiers.model.js';

export const PriceQueryBySkuSchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.required(),
});

export type PriceQueryBySku = z.infer<typeof PriceQueryBySkuSchema>;
