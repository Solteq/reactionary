import { z } from 'zod';
import { BaseModelSchema } from './base.model';

export const IdentityTypeSchema = z.enum(["Anonymous", "Guest", "Registered"]).describe('Type of user identity');

export const IdentitySchema = BaseModelSchema.extend({
    id: z.string().default('').describe('Unique identifier for the user'),
    type: IdentityTypeSchema.default("Anonymous").describe('The type of user account'),
    token: z.string().optional().describe('Authentication token for the session'),
    issued: z.coerce.date().default(new Date()).describe('When the identity/token was issued'),
    expiry: z.coerce.date().default(new Date()).describe('When the identity/token expires')
}).describe('User identity and authentication information');

export type IdentityType = z.infer<typeof IdentityTypeSchema>;
export type Identity = z.infer<typeof IdentitySchema>;