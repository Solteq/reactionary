import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { IdentityIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const AnonymousIdentitySchema = BaseModelSchema.extend({
    type: z.literal('Anonymous'),
});

export const GuestIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema,
    type: z.literal('Guest')
});

export const RegisteredIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema,
    type: z.literal('Registered'),
});

export const IdentitySchema = z.discriminatedUnion('type', [ AnonymousIdentitySchema, GuestIdentitySchema, RegisteredIdentitySchema]);

export type AnonymousIdentity = InferType<typeof AnonymousIdentitySchema>;
export type GuestIdentity = InferType<typeof GuestIdentitySchema>;
export type RegisteredIdentity = InferType<typeof RegisteredIdentitySchema>;
export type Identity = InferType<typeof IdentitySchema>;
