import { z } from 'zod';

export const BaseQuerySchema = z.looseInterface({

});

export type BaseQuery = z.infer<typeof BaseQuerySchema>;