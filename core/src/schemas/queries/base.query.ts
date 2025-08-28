import { z } from 'zod';

export const BaseQuerySchema = z.looseObject({
    query: z.ZodLiteral
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;