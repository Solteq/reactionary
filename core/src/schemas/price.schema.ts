import { z } from 'zod';

export const PriceSchema = z.looseInterface({

});

export type Price = z.infer<typeof PriceSchema>;