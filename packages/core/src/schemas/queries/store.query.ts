import * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import type { InferType } from '../../zod-utils.js';

export const StoreQueryByProximitySchema = BaseQuerySchema.extend({
    longitude: z.number(),
    latitude: z.number(),
    distance: z.number(),
    limit: z.number(),
});

export type StoreQueryByProximity = InferType<typeof StoreQueryByProximitySchema>;
