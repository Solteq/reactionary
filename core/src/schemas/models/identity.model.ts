import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { IdentityIdentifierSchema } from './identifiers.model.js';

export const AnonymousIdentitySchema = BaseModelSchema.extend({
    type: z.literal('Anonymous').default('Anonymous'),
    token: z.string().optional(),
    refresh_token: z.string().optional(),
    expiry: z.coerce.date().default(new Date())
});

export const GuestIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),
    type: z.literal('Guest').default('Guest'),
    token: z.string().optional(),
    refresh_token: z.string().optional(),
    expiry: z.coerce.date().default(new Date())
});

export const RegisteredIdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),
    type: z.literal('Registered').default('Registered'),
    logonId: z.string().default(''),
    token: z.string().optional(),
    refresh_token: z.string().optional(),
    expiry: z.coerce.date().default(new Date())
});

export const IdentitySchema = z.discriminatedUnion('type', [ AnonymousIdentitySchema, GuestIdentitySchema, RegisteredIdentitySchema]);

export type AnonymousIdentity = z.infer<typeof AnonymousIdentitySchema>;
export type GuestIdentity = z.infer<typeof GuestIdentitySchema>;
export type RegisteredIdentity = z.infer<typeof RegisteredIdentitySchema>;
export type Identity = z.infer<typeof IdentitySchema>;
