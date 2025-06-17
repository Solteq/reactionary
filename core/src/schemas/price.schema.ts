import { z } from 'zod';

export const PriceSchema = z.looseInterface({
    value: z.number().default(0)
});

export type Price = z.infer<typeof PriceSchema>;