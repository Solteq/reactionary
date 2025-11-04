import { z } from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { CartIdentifierSchema, CartItemIdentifierSchema, PaymentMethodIdentifierSchema, ShippingMethodIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { AddressSchema } from '../models/profile.model.js';
import { CurrencySchema } from '../models/currency.model.js';
import { MonetaryAmountSchema } from '../models/price.model.js';

export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    sku: ProductVariantIdentifierSchema.nonoptional(),
    quantity: z.number()
});

export const CartMutationItemRemoveSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    item: CartItemIdentifierSchema.nonoptional()
});

export const CartMutationItemQuantityChangeSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    item: CartItemIdentifierSchema.nonoptional(),
    quantity: z.number()
});

export const CartMutationDeleteCartSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required()
});

export const CartMutationSetShippingInfoSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    shippingMethod: ShippingMethodIdentifierSchema.optional(),
    shippingAddress: AddressSchema.optional(),
});

export const CartMutationSetBillingAddressSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    billingAddress: AddressSchema.required(),
    notificationEmailAddress: z.string().optional(),
    notificationPhoneNumber: z.string().optional(),
});

export const CartMutationApplyCouponSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    couponCode: z.string().default('').nonoptional()
});

export const CartMutationRemoveCouponSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    couponCode: z.string().default('').nonoptional()
});

export const CartMutationCheckoutSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required()
});

export const CartMutationAddPaymentMethodSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    paymentMethodId: PaymentMethodIdentifierSchema.required(),
    amount: MonetaryAmountSchema.optional().describe('The amount to authorize for the payment method. If not provided, the full remaining balance of the cart will be authorized.')
});

export const CartMutationRemovePaymentMethodSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
});

export const CartMutationChangeCurrencySchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    newCurrency: CurrencySchema.default(() => CurrencySchema.parse({})).describe('The new currency to set for the cart.')
});


export type CartMutationChangeCurrency = z.infer<typeof CartMutationChangeCurrencySchema>;
export type CartMutationAddPaymentMethod = z.infer<typeof CartMutationAddPaymentMethodSchema>;
export type CartMutationRemovePaymentMethod = z.infer<typeof CartMutationRemovePaymentMethodSchema>;
export type CartMutationCheckout = z.infer<typeof CartMutationCheckoutSchema>;
export type CartMutationItemAdd = z.infer<typeof CartMutationItemAddSchema>;
export type CartMutationItemRemove = z.infer<typeof CartMutationItemRemoveSchema>;
export type CartMutationItemQuantityChange = z.infer<typeof CartMutationItemQuantityChangeSchema>;
export type CartMutationDeleteCart = z.infer<typeof CartMutationDeleteCartSchema>;
export type CartMutationSetShippingInfo = z.infer<typeof CartMutationSetShippingInfoSchema>;
export type CartMutationSetBillingAddress = z.infer<typeof CartMutationSetBillingAddressSchema>;
export type CartMutationApplyCoupon = z.infer<typeof CartMutationApplyCouponSchema>;
export type CartMutationRemoveCoupon = z.infer<typeof CartMutationRemoveCouponSchema>;
