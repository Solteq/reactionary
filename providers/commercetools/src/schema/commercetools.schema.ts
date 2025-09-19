import { CartIdentifierSchema, OrderIdentifierSchema, PaymentInstructionIdentifierSchema } from "@reactionary/core";
import z from "zod";

export const CommercetoolsCartIdentifierSchema = CartIdentifierSchema.extend({
    version: z.number().default(0)
});

export const CommercetoolsCartPaymentInstructionIdentifierSchema = PaymentInstructionIdentifierSchema.extend({
    version: z.number().default(0),
});

export const CommercetoolsOrderIdentifierSchema = OrderIdentifierSchema.extend({
    version: z.number().default(0)
});

export type CommercetoolsCartIdentifier = z.infer<typeof CommercetoolsCartIdentifierSchema>;
export type CommercetoolsCartPaymentInstructionIdentifier = z.infer<typeof CommercetoolsCartPaymentInstructionIdentifierSchema>;
export type CommercetoolsOrderIdentifier = z.infer<typeof CommercetoolsOrderIdentifierSchema>;
