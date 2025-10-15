import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';

export const IdentityQuerySelfSchema = BaseQuerySchema.extend({

});

export type IdentityQuerySelf = z.infer<typeof IdentityQuerySelfSchema>;
