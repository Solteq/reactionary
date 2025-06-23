import { z } from 'zod';

export const BaseQuerySchema = z.looseInterface({
    query: z.ZodLiteral
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;