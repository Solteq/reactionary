import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, IdentityIdentifierSchema, OrderIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { BaseModelSchema } from './base.model.js';
import { AddressSchema } from './profile.model.js';
import { ShippingMethodSchema } from './shipping-method.model.js';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model.js';
import { PaymentInstructionSchema } from './payment.model.js';
import type { InferType } from '../../zod-utils.js';

export const OrderStatusSchema = z.enum(['AwaitingPayment', 'ReleasedToFulfillment', 'Shipped', 'Cancelled']).describe('The current status of the order.');
export const OrderInventoryStatusSchema = z.enum(['NotAllocated', 'Allocated', 'Backordered', 'Preordered']).describe('The inventory release status of the order.');


export const OrderItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema,
    variant: ProductVariantIdentifierSchema,
    quantity: z.number(),
    price: ItemCostBreakdownSchema,
    inventoryStatus: OrderInventoryStatusSchema.describe('The inventory release status of the order item.'),
});

export const OrderSchema = BaseModelSchema.extend({
    identifier: OrderIdentifierSchema,
    userId: IdentityIdentifierSchema,
    items: z.array(OrderItemSchema),
    price: CostBreakDownSchema,
    name: z.string().optional(),
    description: z.string().optional(),
    shippingAddress: AddressSchema.optional(),
    billingAddress: AddressSchema.optional(),
    shippingMethod: ShippingMethodSchema.optional(),
    orderStatus: OrderStatusSchema,
    inventoryStatus: OrderInventoryStatusSchema,
    paymentInstructions: z.array(PaymentInstructionSchema),
    cartReference: CartIdentifierSchema.optional().describe('Reference to the cart from which this order was created.'),
});


export type OrderStatus = InferType<typeof OrderStatusSchema>;
export type OrderInventoryStatus = InferType<typeof OrderInventoryStatusSchema>;
export type OrderItem = InferType<typeof OrderItemSchema>;
export type Order = InferType<typeof OrderSchema>;
