import { z } from "zod";
import { CartIdentifierSchema, AddressSchema, PaymentInstructionIdentifierSchema, PaymentInstructionSchema, ShippingInstructionSchema, CartSchema } from "../models/index.js";
import { BaseMutationSchema } from "./base.mutation.js";


export const CheckoutMutationInitiateCheckoutSchema = BaseMutationSchema.extend({
    cart: CartSchema,
    billingAddress: AddressSchema.omit({ identifier: true, meta: true }).optional(),
    notificationEmail: z.string().optional(),
    notificationPhone: z.string().optional(),
});

export const CheckoutMutationSetShippingAddressSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema,
    shippingAddress: AddressSchema.omit({ identifier: true, meta: true }),
});

export const CheckoutMutationFinalizeCheckoutSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationAddPaymentInstructionSchema = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionSchema.omit({ meta: true, status: true, identifier: true }),
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationRemovePaymentInstructionSchema = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionIdentifierSchema,
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationSetShippingInstructionSchema = BaseMutationSchema.extend({
    shippingInstruction: ShippingInstructionSchema.omit({ meta: true }),
    checkout: CartIdentifierSchema,
});

export type CheckoutMutationInitiateCheckout = z.infer<typeof CheckoutMutationInitiateCheckoutSchema>;
export type CheckoutMutationSetShippingAddress = z.infer<typeof CheckoutMutationSetShippingAddressSchema>;
export type CheckoutMutationFinalizeCheckout = z.infer<typeof CheckoutMutationFinalizeCheckoutSchema>;
export type CheckoutMutationAddPaymentInstruction = z.infer<typeof CheckoutMutationAddPaymentInstructionSchema>;
export type CheckoutMutationRemovePaymentInstruction = z.infer<typeof CheckoutMutationRemovePaymentInstructionSchema>;
export type CheckoutMutationSetShippingInstruction = z.infer<typeof CheckoutMutationSetShippingInstructionSchema>;
