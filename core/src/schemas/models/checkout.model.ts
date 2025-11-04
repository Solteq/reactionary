

import { z } from 'zod';
import { BaseModelSchema } from './base.model.js';
import { CartIdentifierSchema, CheckoutIdentifierSchema, CheckoutItemIdentifierSchema, OrderIdentifierSchema, ProductVariantIdentifierSchema } from './identifiers.model.js';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model.js';
import { AddressSchema } from './profile.model.js';
import { ShippingInstructionSchema } from './shipping-method.model.js';
import { PaymentInstructionSchema } from './payment.model.js';

export const CheckoutItemSchema = z.looseObject({
    identifier: CheckoutItemIdentifierSchema.default(() => CheckoutItemIdentifierSchema.parse({})),
    variant: ProductVariantIdentifierSchema.default(() => ProductVariantIdentifierSchema.parse({})),
    quantity: z.number().default(0),
    price: ItemCostBreakdownSchema.default(() => ItemCostBreakdownSchema.parse({})),
});


/**
 * A checkout represents  the data entity that is used to create an order.
 * The checkout is "stable", meaning you cannot change items or quantities on it. Only shipping, billing, and payment details.
 *
 * This means, a cart is never checked out. Rather you provide the cart and other fixed info to the checkout, and from there you get
 * payments and shipping methods.
 */
export const CheckoutSchema = BaseModelSchema.extend({
    identifier:  CheckoutIdentifierSchema.default(() => CheckoutIdentifierSchema.parse({})),

    /**
     * Do we need this?
     */
    originalCartReference: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),

    /**
     * If the checkout has been completed, this will point to the resulting order.
     */
    resultingOrder: OrderIdentifierSchema.optional(),

    items: z.array(CheckoutItemSchema).default(() => []),
    price: CostBreakDownSchema.default(() => CostBreakDownSchema.parse({})),

    name: z.string().default(''),
    description: z.string().default(''),


    billingAddress: AddressSchema.optional(),

    /**
     * Shipping and billing details can be changed on the checkout, but not items or quantities.
     */
    shippingAddress: AddressSchema.optional(),
    shippingInstruction: ShippingInstructionSchema.optional(),
    paymentInstructions: z.array(PaymentInstructionSchema).default(() => []),

    /**
     * Indicates if the checkout has all the required information to be finalized into an order.
     * This does not mean it will succeed, as there may be issues with payment or shipping, but all required information is present.
     */
    readyForFinalization: z.boolean().default(false).describe('Indicates if the checkout has all the required information to be finalized into an order. This does not mean it will succeed, as there may be issues with payment or shipping, but all required information is present.'),
});




export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;
export type Checkout = z.infer<typeof CheckoutSchema>;
