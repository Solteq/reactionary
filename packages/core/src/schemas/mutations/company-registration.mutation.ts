import * as z from "zod";
import { PointOfContactSchema } from "../models/base.model.js";
import { AddressSchema } from "../models/profile.model.js";
import { BaseMutationSchema } from "./base.mutation.js";
import { AddressIdentifierSchema, CompanyIdentifierSchema } from "../models/identifiers.model.js";
import type { InferType } from "../../zod-utils.js";
import { CompanyRegistrationRequestSchema } from "../models/company-registration.model.js";


export const CompanyRegistrationMutationRegisterSchema = z.object({
  taxIdentifier: z.string().meta({ description: 'The unique identifier for the organizational entity. Could technically also be the DUNS identifier' }),
  dunsIdentifier: z.string().optional().meta({ description: 'The DUNS number of the organizational entity. This is a unique identifier for businesses that can be used for credit reporting and other purposes.' }),
  tinIdentifier: z.string().optional().meta({ description: 'The TIN (Tax Identification Number) of the organizational entity. This is a unique identifier for tax purposes.' }),
  name: z.string().meta({ description: 'The name of the organizational entity. This is the human readable name that will be displayed in the UI.' }),
  pointOfContact: PointOfContactSchema.meta({ description: 'Email and optional phone for the CFO / signatory of the organizational entity' }),
  billingAddress: AddressSchema.meta({ description: 'The billing address for this organizational entity. Not user editable.'}),
});


export type CompanyRegistrationMutationRegister = InferType<typeof CompanyRegistrationMutationRegisterSchema>;


