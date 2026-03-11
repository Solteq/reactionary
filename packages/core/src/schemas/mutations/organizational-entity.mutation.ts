import * as z from "zod";
import { PointOfContactSchema } from "../models/base.model.js";
import { AddressSchema } from "../models/profile.model.js";
import { BaseMutationSchema } from "./base.mutation.js";
import { AddressIdentifierSchema, OrganizationalEntityIdentifierSchema } from "../models/identifiers.model.js";


export const OrganizationalEntityMutationRegisterSchema = z.object({
  taxIdentifier: z.string().meta({ description: 'The unique identifier for the organizational entity. Could technically also be the DUNS identifier' }),
  dunsIdentifier: z.string().optional().meta({ description: 'The DUNS number of the organizational entity. This is a unique identifier for businesses that can be used for credit reporting and other purposes.' }),
  tinIdentifier: z.string().optional().meta({ description: 'The TIN (Tax Identification Number) of the organizational entity. This is a unique identifier for tax purposes.' }),
  name: z.string().meta({ description: 'The name of the organizational entity. This is the human readable name that will be displayed in the UI.' }),
  pointOfContact: PointOfContactSchema.meta({ description: 'Email and optional phone for the CFO / signatory of the organizational entity' }),
  billingAddress: AddressSchema.meta({ description: 'The billing address for this organizational entity. Not user editable.'}),

  /**
   * Email of main administrator of org, who will receive an invitation email to create their account and be linked to the organizational entity as the main point of contact. We will create a user account for them if one doesn't already exist with that email, and link it to the organizational entity as the main admin.
   */
  adminUserEmail: z.string().meta({ description: 'The name of the user that will be created as the admin of this organizational entity' }),
});



export const OrganizationalEntityMutationAddShippingAddress = BaseMutationSchema.extend({
  organizationalEntity: OrganizationalEntityIdentifierSchema,
  address: AddressSchema
})

export const OrganizationalEntityMutationRemoveShippingAddressSchema = BaseMutationSchema.extend({
    organizationalEntity: OrganizationalEntityIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema,
});

export const OrganizationalEntityMutationUpdateShippingAddressSchema = BaseMutationSchema.extend({
    organizationalEntity: OrganizationalEntityIdentifierSchema,
    address: AddressSchema,
});

export const OrganizationalEntityMutationMakeShippingAddressDefault = BaseMutationSchema.extend({
    organizationalEntity: OrganizationalEntityIdentifierSchema,
    addressIdentifier: AddressIdentifierSchema
});

export const OrganizationalEntityMutationSetBillingAddressSchema = BaseMutationSchema.extend({
    organizationalEntity: OrganizationalEntityIdentifierSchema,
    address: AddressSchema
});




