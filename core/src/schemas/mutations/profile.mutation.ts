import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';

export const ProfileMutationUpdateSchema = BaseMutationSchema.extend({
    email: z.email(),
    phone: z.string(),
});

export type ProfileMutationUpdate = z.infer<typeof ProfileMutationUpdateSchema>;