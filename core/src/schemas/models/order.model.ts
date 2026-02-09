import { z } from 'zod';
import { CartIdentifierSchema, IdentityIdentifierSchema, OrderIdentifierSchema, OrderInventoryStatusSchema, OrderItemIdentifierSchema, OrderStatusSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { BaseModelSchema } from './base.model.js';
import { AddressSchema } from './profile.model.js';
import { ShippingMethodSchema } from './shipping-method.model.js';
import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model.js';
import { PaymentInstructionSchema } from './payment.model.js';
import type { InferType } from '../../zod-utils.js';



export const OrderItemSchema = z.looseObject({
    identifier: OrderItemIdentifierSchema,
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


export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderInventoryStatus = InferType<typeof OrderInventoryStatusSchema>;
export type OrderItem = InferType<typeof OrderItemSchema>;
export type Order = InferType<typeof OrderSchema>;
