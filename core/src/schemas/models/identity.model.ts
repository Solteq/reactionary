import { z } from 'zod';
import { BaseModelSchema } from './base.model';

export const IdentityTypeSchema = z.enum(["Anonymous", "Guest", "Registered"]);

export const IdentitySchema = BaseModelSchema.extend({
    id: z.string().default(''),
    type: IdentityTypeSchema.default("Anonymous"),
    token: z.string().optional(),
    issued: z.coerce.date().default(new Date()),
    expiry: z.coerce.date().default(new Date())
});

export type IdentityType = z.infer<typeof IdentityTypeSchema>;
export type Identity = z.infer<typeof IdentitySchema>;