import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation';

export const IdentityMutationLoginSchema = BaseMutationSchema.extend({
    username: z.string(),
    password: z.string()
});

export const IdentityMutationLogoutSchema = BaseMutationSchema.extend({
});


export type IdentityMutationLogin = z.infer<typeof IdentityMutationLoginSchema>;
export type IdentityMutationLogout = z.infer<typeof IdentityMutationLogoutSchema>;
