import { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { SKUIdentifierSchema } from '../models/common/identifiers.model';

export const PriceQueryBySkuSchema = BaseQuerySchema.extend({
    query: z.literal('sku'),
    sku: SKUIdentifierSchema.required(),
});
export const PriceQuerySchema = z.union([PriceQueryBySkuSchema]);

export type PriceQueryBySku = z.infer<typeof PriceQueryBySkuSchema>;
export type PriceQuery = z.infer<typeof PriceQuerySchema>;
