import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const StoreQueryByProximitySchema = BaseQuerySchema.extend({
    longitude: z.number().default(0),
    latitude: z.number().default(0),
    distance: z.number().default(0),
    limit: z.number().default(10)
});

export type StoreQueryByProximity = z.infer<typeof StoreQueryByProximitySchema>;
