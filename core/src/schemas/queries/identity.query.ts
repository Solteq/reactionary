import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const IdentityQuerySelfSchema = BaseQuerySchema.extend({
    query: z.literal('self')
});
export const IdentityQuerySchema = z.union([IdentityQuerySelfSchema]);

export type IdentityQuery = z.infer<typeof IdentityQuerySchema>;
export type IdentityQuerySelf = z.infer<typeof IdentityQuerySelfSchema>;
