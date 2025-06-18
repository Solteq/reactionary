import { z } from 'zod';

export const BaseQuerySchema = z.looseInterface({
    type: z.ZodLiteral
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;