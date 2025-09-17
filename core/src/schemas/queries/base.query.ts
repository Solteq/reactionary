import { z } from 'zod';

export const BaseQuerySchema = z.looseObject({
});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;