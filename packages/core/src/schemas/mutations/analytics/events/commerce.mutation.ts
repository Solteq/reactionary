import * as z from 'zod';
import type { InferType } from '../../../../zod-utils.js';
import { AnalyticsCouponRejectionReasonSchema, AnalyticsStoreRefSchema } from '../../../models/analytics/event-parts.model.js';
import { CartItemSchema, CartSchema } from '../../../models/cart.model.js';
import { CheckoutSchema } from '../../../models/checkout.model.js';
import { CompanySchema } from '../../../models/company.model.js';
import { ProductVariantIdentifierSchema } from '../../../models/identifiers.model.js';
import { OrderSchema } from '../../../models/order.model.js';
import { PaymentMethodSchema } from '../../../models/payment.model.js';
import { ShippingMethodSchema } from '../../../models/shipping-method.model.js';
import { AnalyticsEventMutationBaseSchema } from './base.mutation.js';

const quantity = () => z.number().positive();

// Cart
export const AnalyticsMutationCartItemAddedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema.meta({ description: 'The cart after the item was added.' }),
    variant: ProductVariantIdentifierSchema,
    quantity: quantity().meta({ description: 'The quantity that was added.' }),
});

export const AnalyticsMutationCartItemRemovedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema.meta({ description: 'The cart after the item was removed.' }),
    // Identifier first: CartItemSchema defaults throw on input that lacks required keys instead of failing the union branch.
    removed: z.union([ProductVariantIdentifierSchema, CartItemSchema]).meta({ description: 'The line the storefront rendered, or its sku. The line is gone from the resulting cart.' }),
    quantity: quantity().optional().meta({ description: 'The quantity removed. Defaults to the full quantity of the removed line when that is known.' }),
});

export const AnalyticsMutationCartItemQuantityChangedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
    variant: ProductVariantIdentifierSchema,
    previousQuantity: z.number().min(0),
    newQuantity: z.number().min(0),
});

export const AnalyticsMutationCartViewedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
});

export const AnalyticsMutationCouponAppliedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
    code: z.string(),
});

export const AnalyticsMutationCouponRejectedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
    code: z.string(),
    reason: AnalyticsCouponRejectionReasonSchema.optional(),
});

// Checkout
export const AnalyticsMutationCheckoutStartedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
});

export const AnalyticsMutationShippingInfoAddedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
    shippingMethod: ShippingMethodSchema.optional(),
    store: AnalyticsStoreRefSchema.optional().meta({ description: 'The pickup store, for click and collect.' }),
});

export const AnalyticsMutationPaymentInfoAddedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
    paymentMethod: PaymentMethodSchema,
});

export const AnalyticsMutationOrderPlacedSchema = AnalyticsEventMutationBaseSchema.extend({
    checkout: CheckoutSchema.optional().meta({ description: 'The finalized checkout: what the customer placed. Preferred over order, as the order may not exist yet when the OMS is the order source. Either checkout or order is required.' }),
    order: OrderSchema.optional().meta({ description: 'Deprecated: pass the checkout instead. Either checkout or order is required.', deprecated: true }),
});

// B2B
export const AnalyticsMutationQuoteRequestedSchema = AnalyticsEventMutationBaseSchema.extend({
    cart: CartSchema,
});

export const AnalyticsMutationOrderReorderedSchema = AnalyticsEventMutationBaseSchema.extend({
    order: OrderSchema.meta({ description: 'The order the items were reordered from.' }),
    cart: CartSchema.meta({ description: 'The cart the items were added to.' }),
});

export const AnalyticsMutationCompanyRegisteredSchema = AnalyticsEventMutationBaseSchema.extend({
    company: CompanySchema,
});

export type AnalyticsMutationCartItemAdded = InferType<typeof AnalyticsMutationCartItemAddedSchema>;
export type AnalyticsMutationCartItemRemoved = InferType<typeof AnalyticsMutationCartItemRemovedSchema>;
export type AnalyticsMutationCartItemQuantityChanged = InferType<typeof AnalyticsMutationCartItemQuantityChangedSchema>;
export type AnalyticsMutationCartViewed = InferType<typeof AnalyticsMutationCartViewedSchema>;
export type AnalyticsMutationCouponApplied = InferType<typeof AnalyticsMutationCouponAppliedSchema>;
export type AnalyticsMutationCouponRejected = InferType<typeof AnalyticsMutationCouponRejectedSchema>;
export type AnalyticsMutationCheckoutStarted = InferType<typeof AnalyticsMutationCheckoutStartedSchema>;
export type AnalyticsMutationShippingInfoAdded = InferType<typeof AnalyticsMutationShippingInfoAddedSchema>;
export type AnalyticsMutationPaymentInfoAdded = InferType<typeof AnalyticsMutationPaymentInfoAddedSchema>;
export type AnalyticsMutationOrderPlaced = InferType<typeof AnalyticsMutationOrderPlacedSchema>;
export type AnalyticsMutationQuoteRequested = InferType<typeof AnalyticsMutationQuoteRequestedSchema>;
export type AnalyticsMutationOrderReordered = InferType<typeof AnalyticsMutationOrderReorderedSchema>;
export type AnalyticsMutationCompanyRegistered = InferType<typeof AnalyticsMutationCompanyRegisteredSchema>;
