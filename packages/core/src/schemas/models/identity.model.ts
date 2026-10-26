import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { IdentityIdentifierSchema } from './identifiers.model.js';
import { AddressSchema } from './profile.model.js';
import type { InferType } from '../../zod-utils.js';

export const AnonymousIdentitySchema = BaseModelSchema.extend({
    type: z.literal('Anonymous'),
});

export const GuestIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema,
    type: z.literal('Guest')
});

/**
 * What an external login learned about the shopper, for the storefront to put on the profile. Only set on the result of
 * completeExternalLogin, never stored in the session.
 */
export const ExternalLoginResultSchema = z.object({
    isNewCustomer: z.boolean().meta({ description: 'True when this login created the customer in the backend. Only then is the profile data worth writing, so later edits in the shop are never overwritten.' }),
    profile: z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        billingAddress: AddressSchema.optional(),
    }),
});

export const RegisteredIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema,
    type: z.literal('Registered'),
    externalLogin: ExternalLoginResultSchema.optional(),
});

export const IdentitySchema = z.discriminatedUnion('type', [ AnonymousIdentitySchema, GuestIdentitySchema, RegisteredIdentitySchema]);

export type AnonymousIdentity = InferType<typeof AnonymousIdentitySchema>;
export type GuestIdentity = InferType<typeof GuestIdentitySchema>;
export type ExternalLoginResult = InferType<typeof ExternalLoginResultSchema>;
export type RegisteredIdentity = InferType<typeof RegisteredIdentitySchema>;
export type Identity = InferType<typeof IdentitySchema>;
