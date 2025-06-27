import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';

export const IdentityMutationLoginSchema = BaseMutationSchema.extend({
    mutation: z.literal('login'),
    username: z.string(),
    password: z.string()
});

export const IdentityMutationLogoutSchema = BaseMutationSchema.extend({
    mutation: z.literal('logout')
});

export const IdentityMutationSchema = z.union([IdentityMutationLoginSchema, IdentityMutationLogoutSchema]);

export type IdentityMutation = z.infer<typeof IdentityMutationSchema>;
export type IdentityMutationLogin = z.infer<typeof IdentityMutationLoginSchema>;
export type IdentityMutationLogout = z.infer<typeof IdentityMutationLogoutSchema>;