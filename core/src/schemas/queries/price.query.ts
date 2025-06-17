import { z } from 'zod';

export const PriceQuerySchema = z.looseInterface({
    sku: z.string()
});

export type PriceQuery = z.infer<typeof PriceQuerySchema>;