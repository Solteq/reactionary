import { CartIdentifierSchema, CheckoutIdentifierSchema, OrderIdentifierSchema, PaymentInstructionIdentifierSchema } from "@reactionary/core";
import z from "zod";

export const CommercetoolsCartIdentifierSchema = CartIdentifierSchema.extend({
    version: z.number().default(0)
});


export const CommercetoolsOrderIdentifierSchema = OrderIdentifierSchema.extend({
    version: z.number().default(0)
});

export const CommercetoolsCheckoutIdentifierSchema = CheckoutIdentifierSchema.extend({
    version: z.number().default(0)
});

export type CommercetoolsCheckoutIdentifier = z.infer<typeof CommercetoolsCheckoutIdentifierSchema>;

export type CommercetoolsCartIdentifier = z.infer<typeof CommercetoolsCartIdentifierSchema>;
export type CommercetoolsOrderIdentifier = z.infer<typeof CommercetoolsOrderIdentifierSchema>;
