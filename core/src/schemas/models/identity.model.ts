import { z } from 'zod';
import { BaseModelSchema } from './base.model';
import { IdentityIdentifierSchema } from './identifiers.model';

export const IdentityTypeSchema = z.enum(["Anonymous", "Guest", "Registered"]);


export const ServiceTokenSchema = z.object({
    service: z.string().default(''),
    token: z.string().default(''),
    issued: z.coerce.date().default(new Date()),
    expiry: z.coerce.date().default(new Date())
});

export const IdentitySchema = BaseModelSchema.extend({
    id: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),
    type: IdentityTypeSchema.default("Anonymous"),

    logonId: z.string().default(''),

    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
    // Tokens for various services
    //    keyring: z.array(ServiceTokenSchema).default(() => []),

    // Deprecated - use serviceTokens map instead
    currentService: z.string().optional(),

    token: z.string().optional(),
    refresh_token: z.string().optional(),
    issued: z.coerce.date().default(new Date()),
    expiry: z.coerce.date().default(new Date())
});

export type IdentityType = z.infer<typeof IdentityTypeSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
