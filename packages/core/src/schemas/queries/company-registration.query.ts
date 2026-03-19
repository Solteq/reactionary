import * as z from "zod";
import { CompanyRegistrationRequestIdentifierSchema } from "../models/identifiers.model.js";




export const CompanyRegistrationQueryCheckRegistrationStatusSchema = z.object({
  requestIdentifier: CompanyRegistrationRequestIdentifierSchema
});

export type CompanyRegistrationQueryCheckRegistrationStatus = z.infer<typeof CompanyRegistrationQueryCheckRegistrationStatusSchema>;

