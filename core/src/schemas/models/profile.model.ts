import { z } from "zod";
import { AddressIdentifierSchema, IdentityIdentifierSchema } from "./identifiers.model.js";
import { BaseModelSchema } from "./base.model.js";

export const AddressSchema = BaseModelSchema.extend({
    identifier: AddressIdentifierSchema.default(() => AddressIdentifierSchema.parse({})),
    firstName: z.string(),
    lastName: z.string(),
    streetAddress: z.string(),
    streetNumber: z.string(),
    city: z.string(),
    region: z.string(),
    postalCode: z.string(),
    countryCode: z.string(),
});

export const ProfileSchema = BaseModelSchema.extend({
    identifier: IdentityIdentifierSchema,
    email: z.email(),
    phone: z.string(),
    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    shippingAddress: AddressSchema.optional(),
    billingAddress: AddressSchema.optional(),
    alternateShippingAddresses: z.array(AddressSchema),
});

export type Address = z.infer<typeof AddressSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
