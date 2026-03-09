import * as z from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import type { InferType } from '../../zod-utils.js';

export const IdentityMutationLoginSchema = BaseMutationSchema.extend({
    username: z.string(),
    password: z.string()
});

export const IdentityMutationLogoutSchema = BaseMutationSchema.extend({
});

export const IdentityMutationRegisterSchema = BaseMutationSchema.extend({
    username: z.string(),
    password: z.string()
});


export type IdentityMutationLogin = InferType<typeof IdentityMutationLoginSchema>;
export type IdentityMutationLogout = InferType<typeof IdentityMutationLogoutSchema>;
export type IdentityMutationRegister = InferType<typeof IdentityMutationRegisterSchema>;