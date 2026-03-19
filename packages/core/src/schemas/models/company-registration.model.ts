import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { PointOfContactSchema } from './base.model.js';
import { CompanyIdentifierSchema, CompanyRegistrationRequestApprovalStatusSchema, CompanyRegistrationRequestIdentifierSchema } from './identifiers.model.js';


export const CompanyRegistrationRequestSchema = z.object({
  identifier: CompanyRegistrationRequestIdentifierSchema,
  companyIdentifier: CompanyIdentifierSchema,
  name: z.string(),
  pointOfContact: PointOfContactSchema,
  status: CompanyRegistrationRequestApprovalStatusSchema,
  comment: z.string().optional().meta({ description: 'An optional comment from the admin reviewing the organizational entity registration. This can be used to provide feedback to the user about why their registration was denied or what they need to do to get approved.' }),
});

export type CompanyRegistrationRequest = InferType<typeof CompanyRegistrationRequestSchema>;
