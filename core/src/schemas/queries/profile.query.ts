import type { z } from 'zod';
import { BaseQuerySchema } from './base.query';

export const ProfileQuerySelfSchema = BaseQuerySchema.extend({
});

export type ProfileQuerySelf = z.infer<typeof ProfileQuerySelfSchema>;
