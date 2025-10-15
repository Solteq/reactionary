import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';

export const ProfileMutationUpdateSchema = BaseMutationSchema.extend({
    email: z.email().default('base@example.com'),
    phone: z.string().default(''),
});

export type ProfileMutationUpdate = z.infer<typeof ProfileMutationUpdateSchema>;