import type { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { SKUIdentifierSchema } from '../models/identifiers.model';

export const PriceQueryBySkuSchema = BaseQuerySchema.extend({
    sku: SKUIdentifierSchema.required(),
});

export type PriceQueryBySku = z.infer<typeof PriceQueryBySkuSchema>;
