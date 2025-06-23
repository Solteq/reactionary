import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { SKUIdentifierSchema } from '../models/identifiers.model';

export const PriceQueryBySkuSchema = BaseQuerySchema.extend({
    query: z.literal('sku').default('sku'),
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
});

export const PriceQuerySchema = z.union([PriceQueryBySkuSchema]).default(() => PriceQueryBySkuSchema.parse({}));

export type PriceQueryBySku = z.infer<typeof PriceQueryBySkuSchema>;
export type PriceQuery = z.infer<typeof PriceQuerySchema>;
