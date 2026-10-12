import * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { StoreIdentifierSchema } from '../models/identifiers.model.js';
import { PaginationOptionsSchema } from '../models/base.model.js';
import type { InferType } from '../../zod-utils.js';

export const StoreQueryByProximitySchema = BaseQuerySchema.extend({
    longitude: z.number(),
    latitude: z.number(),
    distance: z.number(),
    limit: z.number(),
});

export const StoreQueryByIdSchema = BaseQuerySchema.extend({
    identifier: StoreIdentifierSchema,
});

export const StoreQueryForListSchema = BaseQuerySchema.extend({
    paginationOptions: PaginationOptionsSchema,
});

export type StoreQueryByProximity = InferType<typeof StoreQueryByProximitySchema>;
export type StoreQueryById = InferType<typeof StoreQueryByIdSchema>;
export type StoreQueryForList = InferType<typeof StoreQueryForListSchema>;
