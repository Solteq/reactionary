import * as z from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { IdentityProviderIdentifierSchema } from '../models/identity-provider.model.js';
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

export const IdentityMutationStartExternalLoginSchema = BaseMutationSchema.extend({
    provider: IdentityProviderIdentifierSchema,
    callbackUrl: z.url().meta({ description: 'The storefront URL the identity provider returns the shopper to. Must be registered with the identity provider.' }),
    prompt: z.enum(['login', 'consent', 'select_account']).optional().meta({ description: 'The OpenID Connect prompt parameter. login makes the identity provider ask the shopper to authenticate again even if they still have a session there, which keeps a shared device from signing straight back in. Ignored by backends that do not use OpenID Connect.' }),
});

export const IdentityMutationCompleteExternalLoginSchema = BaseMutationSchema.extend({
    provider: IdentityProviderIdentifierSchema,
    callbackUrl: z.url().meta({ description: 'The same callbackUrl that was passed to startExternalLogin.' }),
    callbackParameters: z.record(z.string(), z.string()).meta({ description: 'The query parameters the identity provider appended to the callback URL, passed through unchanged.' }),
});

export type IdentityMutationLogin = InferType<typeof IdentityMutationLoginSchema>;
export type IdentityMutationLogout = InferType<typeof IdentityMutationLogoutSchema>;
export type IdentityMutationRegister = InferType<typeof IdentityMutationRegisterSchema>;
export type IdentityMutationStartExternalLogin = InferType<typeof IdentityMutationStartExternalLoginSchema>;
// InferType strips index signatures, which would reduce callbackParameters to {}.
export type IdentityMutationCompleteExternalLogin = Omit<InferType<typeof IdentityMutationCompleteExternalLoginSchema>, 'callbackParameters'> & {
    callbackParameters: Record<string, string>;
};
