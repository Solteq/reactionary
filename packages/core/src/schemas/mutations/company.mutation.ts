import type { InferType } from "../../zod-utils.js";
import { AddressIdentifierSchema, CompanyIdentifierSchema } from "../models/identifiers.model.js";
import { AddressSchema } from "../models/profile.model.js";
import { BaseMutationSchema } from "./base.mutation.js";



export const CompanyMutationAddShippingAddressSchema = BaseMutationSchema.extend({
  company: CompanyIdentifierSchema,
  address: AddressSchema
});

export const CompanyMutationRemoveShippingAddressSchema = BaseMutationSchema.extend({
    company: CompanyIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema,
});

export const CompanyMutationUpdateShippingAddressSchema = BaseMutationSchema.extend({
    company: CompanyIdentifierSchema,
    address: AddressSchema,
});

export const CompanyMutationMakeShippingAddressDefaultSchema = BaseMutationSchema.extend({
    company: CompanyIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema
});

export const CompanyMutationSetBillingAddressSchema = BaseMutationSchema.extend({
    company: CompanyIdentifierSchema,
    address: AddressSchema
});




export type CompanyMutationAddShippingAddress = InferType<typeof CompanyMutationAddShippingAddressSchema>;
export type CompanyMutationRemoveShippingAddress = InferType<typeof CompanyMutationRemoveShippingAddressSchema>;
export type CompanyMutationUpdateShippingAddress = InferType<typeof CompanyMutationUpdateShippingAddressSchema>;
export type CompanyMutationMakeShippingAddressDefault = InferType<typeof CompanyMutationMakeShippingAddressDefaultSchema>;
export type CompanyMutationSetBillingAddress = InferType<typeof CompanyMutationSetBillingAddressSchema>;

