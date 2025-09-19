import z from "zod";
import { CartIdentifierSchema, PaymentInstructionIdentifierSchema } from "../models/identifiers.model";
import { PaymentInstructionSchema } from "../models/payment.model";
import { BaseMutationSchema } from "./base.mutation";



export const CartPaymentMutationAddPayment = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionSchema.omit({ meta: true, status: true, identifier: true }).required(),
    cart: CartIdentifierSchema.required()
});

export const CartPaymentMutationCancelPayment = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionIdentifierSchema.required(),
    cart: CartIdentifierSchema.required()
});



export type CartPaymentMutationAddPayment = z.infer<typeof CartPaymentMutationAddPayment>;
export type CartPaymentMutationCancelPayment = z.infer<typeof CartPaymentMutationCancelPayment>;
