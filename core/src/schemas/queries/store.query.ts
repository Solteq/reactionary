import { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';

export const StoreQueryByProximitySchema = BaseQuerySchema.extend({
    longitude: z.number(),
    latitude: z.number(),
    distance: z.number(),
    limit: z.number(),
});

export type StoreQueryByProximity = z.infer<typeof StoreQueryByProximitySchema>;
