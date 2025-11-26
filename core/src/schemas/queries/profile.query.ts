import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';

export const ProfileQuerySelfSchema = BaseQuerySchema.extend({
});

export type ProfileQuerySelf = InferType<typeof ProfileQuerySelfSchema>;
