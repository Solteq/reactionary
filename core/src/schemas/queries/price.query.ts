import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const ListPriceQuerySchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema
});

export const CustomerPriceQuerySchema = BaseQuerySchema.extend({
    variant: ProductVariantIdentifierSchema
});

export type ListPriceQuery = InferType<typeof ListPriceQuerySchema>;
export type CustomerPriceQuery = InferType<typeof CustomerPriceQuerySchema>;