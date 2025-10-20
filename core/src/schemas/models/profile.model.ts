import { z } from "zod";
import { AddressIdentifierSchema, IdentityIdentifierSchema } from "./identifiers.model.js";
import { BaseModelSchema } from "./base.model.js";

export const AddressSchema = BaseModelSchema.extend({
    identifier: AddressIdentifierSchema.default(() => AddressIdentifierSchema.parse({})),
    firstName: z.string().default(''),
    lastName: z.string().default(''),
    streetAddress: z.string().default(''),
    streetNumber: z.string().default(''),
    city: z.string().default(''),
    region: z.string().default(''),
    postalCode: z.string().default(''),
    countryCode: z.string().default('US'),
});

export const ProfileSchema = BaseModelSchema.extend({
    identifier: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),
    email: z.string().email().default(''),
    phone: z.string().default(''),

    emailVerified: z.boolean().default(false),
    phoneVerified: z.boolean().default(false),

    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),

    shippingAddress: AddressSchema.optional(),
    billingAddress: AddressSchema.optional(),

    alternateShippingAddresses: z.array(AddressSchema).default(() => []),
});

export type Address = z.infer<typeof AddressSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
