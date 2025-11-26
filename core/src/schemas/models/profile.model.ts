import { z } from "zod";
import { AddressIdentifierSchema, IdentityIdentifierSchema } from "./identifiers.model.js";
import { BaseModelSchema } from "./base.model.js";
import type { InferType } from '../../zod-utils.js';

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

export type Address = InferType<typeof AddressSchema>;
export type Profile = InferType<typeof ProfileSchema>;
