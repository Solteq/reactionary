import { z } from "zod";
import { CartIdentifierSchema, AddressSchema, PaymentInstructionIdentifierSchema, PaymentInstructionSchema, ShippingInstructionSchema, CartSchema } from "../models/index.js";
import { BaseMutationSchema } from "./base.mutation.js";
import type { InferType } from '../../zod-utils.js';


export const CheckoutMutationInitiateCheckoutSchema = BaseMutationSchema.extend({
    cart: CartSchema,
    billingAddress: AddressSchema.omit({ identifier: true }).optional(),
    notificationEmail: z.string().optional(),
    notificationPhone: z.string().optional(),
});

export const CheckoutMutationSetShippingAddressSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema,
    shippingAddress: AddressSchema.omit({ identifier: true }),
});

export const CheckoutMutationFinalizeCheckoutSchema = BaseMutationSchema.extend({
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationAddPaymentInstructionSchema = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionSchema.omit({ status: true, identifier: true }),
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationRemovePaymentInstructionSchema = BaseMutationSchema.extend({
    paymentInstruction: PaymentInstructionIdentifierSchema,
    checkout: CartIdentifierSchema,
});

export const CheckoutMutationSetShippingInstructionSchema = BaseMutationSchema.extend({
    shippingInstruction: ShippingInstructionSchema,
    checkout: CartIdentifierSchema,
});

export type CheckoutMutationInitiateCheckout = InferType<typeof CheckoutMutationInitiateCheckoutSchema>;
export type CheckoutMutationSetShippingAddress = InferType<typeof CheckoutMutationSetShippingAddressSchema>;
export type CheckoutMutationFinalizeCheckout = InferType<typeof CheckoutMutationFinalizeCheckoutSchema>;
export type CheckoutMutationAddPaymentInstruction = InferType<typeof CheckoutMutationAddPaymentInstructionSchema>;
export type CheckoutMutationRemovePaymentInstruction = InferType<typeof CheckoutMutationRemovePaymentInstructionSchema>;
export type CheckoutMutationSetShippingInstruction = InferType<typeof CheckoutMutationSetShippingInstructionSchema>;
