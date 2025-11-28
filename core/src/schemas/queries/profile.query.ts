import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import type { InferType } from '../../zod-utils.js';

export const ProfileQuerySelfSchema = BaseQuerySchema.extend({
});

export type ProfileQuerySelf = InferType<typeof ProfileQuerySelfSchema>;
