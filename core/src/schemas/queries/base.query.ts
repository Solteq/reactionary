import { z } from 'zod';

export const BaseQuerySchema = z.looseInterface({
    query: z.string()
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;