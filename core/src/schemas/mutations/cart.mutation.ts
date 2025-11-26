import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { CartIdentifierSchema, CartItemIdentifierSchema, PaymentMethodIdentifierSchema, ShippingMethodIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { AddressSchema } from '../models/profile.model.js';
import { CurrencySchema } from '../models/currency.model.js';
import { MonetaryAmountSchema } from '../models/price.model.js';
import type { InferType } from '../../zod-utils.js';

export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    variant: ProductVariantIdentifierSchema,
    quantity: z.number()
});

export const CartMutationItemRemoveSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema,
});

export const CartMutationItemQuantityChangeSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema,
    quantity: z.number()
});

export const CartMutationDeleteCartSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema
});

export const CartMutationSetShippingInfoSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    shippingMethod: ShippingMethodIdentifierSchema.optional(),
    shippingAddress: AddressSchema.optional(),
});

export const CartMutationSetBillingAddressSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    billingAddress: AddressSchema,
    notificationEmailAddress: z.string().optional(),
    notificationPhoneNumber: z.string().optional(),
});

export const CartMutationApplyCouponSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    couponCode: z.string()
});

export const CartMutationRemoveCouponSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    couponCode: z.string()
});

export const CartMutationCheckoutSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema
});

export const CartMutationAddPaymentMethodSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    paymentMethodId: PaymentMethodIdentifierSchema,
    amount: MonetaryAmountSchema.optional().describe('The amount to authorize for the payment method. If not provided, the full remaining balance of the cart will be authorized.')
});

export const CartMutationRemovePaymentMethodSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
});

export const CartMutationChangeCurrencySchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    newCurrency: CurrencySchema.describe('The new currency to set for the cart.')
});

export type CartMutationChangeCurrency = InferType<typeof CartMutationChangeCurrencySchema>;
export type CartMutationAddPaymentMethod = InferType<typeof CartMutationAddPaymentMethodSchema>;
export type CartMutationRemovePaymentMethod = InferType<typeof CartMutationRemovePaymentMethodSchema>;
export type CartMutationCheckout = InferType<typeof CartMutationCheckoutSchema>;
export type CartMutationItemAdd = InferType<typeof CartMutationItemAddSchema>;
export type CartMutationItemRemove = InferType<typeof CartMutationItemRemoveSchema>;
export type CartMutationItemQuantityChange = InferType<typeof CartMutationItemQuantityChangeSchema>;
export type CartMutationDeleteCart = InferType<typeof CartMutationDeleteCartSchema>;
export type CartMutationSetShippingInfo = InferType<typeof CartMutationSetShippingInfoSchema>;
export type CartMutationSetBillingAddress = InferType<typeof CartMutationSetBillingAddressSchema>;
export type CartMutationApplyCoupon = InferType<typeof CartMutationApplyCouponSchema>;
export type CartMutationRemoveCoupon = InferType<typeof CartMutationRemoveCouponSchema>;
