import * as z from "zod";
import type { InferType } from "../../zod-utils.js";
import { PointOfContactSchema } from "../models/base.model.js";
import { AddressSchema } from "../models/profile.model.js";


export const CompanyRegistrationMutationRegisterSchema = z.object({
  taxIdentifier: z.string().meta({ description: 'The unique identifier for the company. Could technically also be the DUNS identifier' }),
  dunsIdentifier: z.string().optional().meta({ description: 'The DUNS number of the company. This is a unique identifier for businesses that can be used for credit reporting and other purposes.' }),
  tinIdentifier: z.string().optional().meta({ description: 'The TIN (Tax Identification Number) of the company. This is a unique identifier for tax purposes.' }),
  name: z.string().meta({ description: 'The name of the company. This is the human readable name that will be displayed in the UI.' }),
  pointOfContact: PointOfContactSchema.meta({ description: 'Email and optional phone for the CFO / signatory of the company' }),
  billingAddress: AddressSchema.meta({ description: 'The billing address for this company. Not user editable.'}),
});


export type CompanyRegistrationMutationRegister = InferType<typeof CompanyRegistrationMutationRegisterSchema>;


