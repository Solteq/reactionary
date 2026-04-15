import * as z from 'zod';
import { BaseMutationSchema } from './base.mutation.js';
import { CartIdentifierSchema, CartItemIdentifierSchema, PaymentMethodIdentifierSchema, ShippingMethodIdentifierSchema, ProductVariantIdentifierSchema, CompanyIdentifierSchema } from '../models/identifiers.model.js';
import { AddressSchema } from '../models/profile.model.js';
import { CurrencySchema } from '../models/currency.model.js';
import { MonetaryAmountSchema } from '../models/price.model.js';
import type { InferType } from '../../zod-utils.js';

export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    variant: ProductVariantIdentifierSchema,
    quantity: z.number().min(1).default(1).meta({ description: 'The quantity of the item to add to the cart. Must be at least 1.' }),
});

export const CartMutationItemRemoveSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema,
});

export const CartMutationItemQuantityChangeSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema,
    item: CartItemIdentifierSchema,
    quantity: z.number().min(1).meta({ description: 'The new quantity for the cart item. Must be at least 1. If you want to remove the item from the cart, use the CartMutationItemRemove mutation instead.' }),
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

export const CartMutationCreateCartSchema = BaseMutationSchema.extend({
    company: CompanyIdentifierSchema.optional().meta({ description: 'The company identifier for the new cart. This can be used to associate the cart with a specific company, which can be useful for B2B use cases.' }),
    name: z.string().optional().meta({ description: 'The name for the new cart. This can be used to give the cart a human readable name that can be displayed in the UI.' }),
});

export const CartMutationRenameCartSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.required(),
    newName: z.string().meta({ description: 'The new name for the cart.' }),
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
export type CartMutationCreateCart = InferType<typeof CartMutationCreateCartSchema>;
export type CartMutationRenameCart = InferType<typeof CartMutationRenameCartSchema>;
