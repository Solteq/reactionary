import { BaseModelSchema, CartIdentifierSchema, CheckoutIdentifierSchema, OrderIdentifierSchema } from "@reactionary/core";
import * as z from "zod";

export const CommercetoolsCartIdentifierSchema = CartIdentifierSchema.extend({
    version: z.number().default(0)
});

export const CommercetoolsOrderIdentifierSchema = OrderIdentifierSchema.extend({
    version: z.number().default(0)
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

export type CommercetoolsCheckoutIdentifier = z.infer<typeof CommercetoolsCheckoutIdentifierSchema>;
export type CommercetoolsCartIdentifier = z.infer<typeof CommercetoolsCartIdentifierSchema>;
export type CommercetoolsOrderIdentifier = z.infer<typeof CommercetoolsOrderIdentifierSchema>;
export type CommercetoolsResolveCategoryQueryByKey = z.infer<typeof CommercetoolsResolveCategoryQueryByKeySchema>;
export type CommercetoolsResolveCategoryQueryById = z.infer<typeof CommercetoolsResolveCategoryQueryByIdSchema>;
export type CommercetoolsCategoryLookup = z.infer<typeof CommercetoolsCategoryLookupSchema>;
