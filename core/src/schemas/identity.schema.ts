import { z } from 'zod';

export const IdentityTypeSchema = z.enum(["Anonymous", "Guest", "Registered"]);

export const IdentitySchema = z.looseInterface({
    id: z.string().default(''),
    type: IdentityTypeSchema.default("Anonymous"),
    token: z.string().optional(),
    issued: z.coerce.date().default(new Date()),
    expiry: z.coerce.date().default(new Date())
});

export const IdentityLoginPayloadSchema = z.looseInterface({
    username: z.string().default(''),
    password: z.string().default('')
});

export type IdentityType = z.infer<typeof IdentityTypeSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type IdentityLoginPayload = z.infer<typeof IdentityLoginPayloadSchema>;