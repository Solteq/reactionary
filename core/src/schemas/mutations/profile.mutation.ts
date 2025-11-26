import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import type { InferType } from '../../zod-utils.js';

export const ProfileMutationUpdateSchema = BaseMutationSchema.extend({
    email: z.email(),
    phone: z.string(),
});

export type ProfileMutationUpdate = InferType<typeof ProfileMutationUpdateSchema>;