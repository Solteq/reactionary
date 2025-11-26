import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import type { InferType } from '../../zod-utils.js';

export const IdentityQuerySelfSchema = BaseQuerySchema.extend({

});

export type IdentityQuerySelf = InferType<typeof IdentityQuerySelfSchema>;
