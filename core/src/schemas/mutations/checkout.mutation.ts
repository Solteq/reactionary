import  z from "zod";
import { CartIdentifierSchema, AddressSchema, PaymentInstructionIdentifierSchema, PaymentInstructionSchema, ShippingInstructionSchema } from "../models";
import { BaseMutationSchema } from "./base.mutation";


export const CheckoutMutationInitiateCheckoutSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    billingAddress: AddressSchema.omit({identifier: true}).optional(),
    notificationEmail: z.string().optional(),
    notificationPhone: z.string().optional(),
});

export const CheckoutMutationSetShippingAddressSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema.required(),
    shippingAddress: AddressSchema.omit({identifier: true}).required(),
});


export const CheckoutMutationFinalizeCheckoutSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema.required(),
});


export const CheckoutMutationAddPaymentInstruction = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionSchema.omit({ meta: true, status: true, identifier: true }).required(),
    checkout: CartIdentifierSchema.required()
});

export const CheckoutMutationRemovePaymentInstruction = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionIdentifierSchema.required(),
    checkout: CartIdentifierSchema.required()
});



export const CheckoutMutationSetShippingInstruction = BaseMutationSchema.extend({
    shippingInstruction: ShippingInstructionSchema.omit({ meta: true, status: true, identifier: true }).required(),
    checkout: CartIdentifierSchema.required()
});





export type CheckoutMutationInitiateCheckout = z.infer<typeof CheckoutMutationInitiateCheckoutSchema>;
export type CheckoutMutationSetShippingAddress = z.infer<typeof CheckoutMutationSetShippingAddressSchema>;
export type CheckoutMutationFinalizeCheckout = z.infer<typeof CheckoutMutationFinalizeCheckoutSchema>;
export type CheckoutMutationAddPaymentInstruction = z.infer<typeof CheckoutMutationAddPaymentInstruction>;
export type CheckoutMutationRemovePaymentInstruction = z.infer<typeof CheckoutMutationRemovePaymentInstruction>;
export type CheckoutMutationSetShippingInstruction = z.infer<typeof CheckoutMutationSetShippingInstruction>;
