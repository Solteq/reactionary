import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import type { InferType } from '../../zod-utils.js';
import { AddressIdentifierSchema, IdentityIdentifierSchema } from '../models/identifiers.model.js';
import { AddressSchema } from '../models/profile.model.js';

export const ProfileMutationUpdateSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    email: z.email().describe('The main contact email of the profile'),
    phone: z.string().describe('The main phone number of the profile'),
});

export const ProfileMutationAddShippingAddressSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    address: AddressSchema,
});

export const ProfileMutationRemoveShippingAddressSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema,
});

export const ProfileMutationUpdateShippingAddressSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    address: AddressSchema,
});

export const ProfileMutationMakeShippingAddressDefaultSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema,
});

export const ProfileMutationSetBillingAddressSchema = BaseMutationSchema.extend({
    identifier: IdentityIdentifierSchema,
    address: AddressSchema,
});


export type ProfileMutationUpdate = InferType<typeof ProfileMutationUpdateSchema>;
export type ProfileMutationAddShippingAddress = InferType<typeof ProfileMutationAddShippingAddressSchema>;
export type ProfileMutationRemoveShippingAddress = InferType<typeof ProfileMutationRemoveShippingAddressSchema>;
export type ProfileMutationMakeShippingAddressDefault = InferType<typeof ProfileMutationMakeShippingAddressDefaultSchema>;
export type ProfileMutationSetBillingAddress = InferType<typeof ProfileMutationSetBillingAddressSchema>;
export type ProfileMutationUpdateShippingAddress = InferType<typeof ProfileMutationUpdateShippingAddressSchema>;
