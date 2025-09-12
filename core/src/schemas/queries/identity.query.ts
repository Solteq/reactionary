import { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const IdentityQuerySelfSchema = BaseQuerySchema.extend({

});

export type IdentityQuerySelf = z.infer<typeof IdentityQuerySelfSchema>;
