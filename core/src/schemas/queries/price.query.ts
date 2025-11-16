import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { ProductVariantIdentifierSchema } from '../models/identifiers.model.js';

export const ListPriceQuerySchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.required()
});

export const CustomerPriceQuerySchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema.required()
});

export type ListPriceQuery = z.infer<typeof ListPriceQuerySchema>;
export type CustomerPriceQuery = z.infer<typeof CustomerPriceQuerySchema>;