import { BaseModelSchema, CartIdentifierSchema, CheckoutIdentifierSchema, OrderIdentifierSchema, EmployeeInvitationSchema, CompanyIdentifierSchema } from "@reactionary/core";
import * as z from "zod";

export const CommercetoolsCartIdentifierSchema = CartIdentifierSchema.extend({
    version: z.number().default(0),
    company: CompanyIdentifierSchema.optional(),
});


export const CommercetoolsOrderIdentifierSchema = OrderIdentifierSchema.extend({
    version: z.number().default(0),
    company: CompanyIdentifierSchema.optional(),
});

export const CommercetoolsCheckoutIdentifierSchema = CheckoutIdentifierSchema.extend({
    version: z.number().default(0)
});

export const CommercetoolsResolveCategoryQueryByKeySchema = z.object({
    key: z.string().meta({ description: 'The key of the category to resolve.' }),
});
export const CommercetoolsResolveCategoryQueryByIdSchema = z.object({
    id: z.string().meta({ description: 'The ID of the category to resolve.' }),
});
export const CommercetoolsCategoryLookupSchema = BaseModelSchema.extend({
    id: z.string(),
    key: z.string().optional(),
    name: z.record(z.string(), z.string()),
});


export const CommercetoolsEmployeeInviteCustomObjectValueSchema = EmployeeInvitationSchema.omit({ identifier: true }).extend({
  tokenHash: z.string(),
  invitedBy: z.string(),
  invitedDate: z.string(),
  acceptedBy: z.string().optional(),
  acceptedDate: z.string().optional(),
  lastUpdatedBy: z.string(),
  lastUpdatedDate: z.string(),
});

export const CommercetoolsEmployeeInviteCustomObjectSchema = z.looseObject({
  key: z.string().meta({ description: 'The unique identifier for the employee invitation.' }),
  value: CommercetoolsEmployeeInviteCustomObjectValueSchema,
  container: z.string().meta({ description: 'The container for the custom object. This is used to group related custom objects together and can be used as a namespace to avoid key collisions.' }),
  version: z.number().default(0),
});

export type CommercetoolsCheckoutIdentifier = z.infer<typeof CommercetoolsCheckoutIdentifierSchema>;
export type CommercetoolsCartIdentifier = z.infer<typeof CommercetoolsCartIdentifierSchema>;
export type CommercetoolsOrderIdentifier = z.infer<typeof CommercetoolsOrderIdentifierSchema>;
export type CommercetoolsResolveCategoryQueryByKey = z.infer<typeof CommercetoolsResolveCategoryQueryByKeySchema>;
export type CommercetoolsResolveCategoryQueryById = z.infer<typeof CommercetoolsResolveCategoryQueryByIdSchema>;
export type CommercetoolsCategoryLookup = z.infer<typeof CommercetoolsCategoryLookupSchema>;
export type CommercetoolsEmployeeInviteCustomObject = z.infer<typeof CommercetoolsEmployeeInviteCustomObjectSchema>;
export type CommercetoolsEmployeeInviteCustomObjectValue = z.infer<typeof CommercetoolsEmployeeInviteCustomObjectValueSchema>;
