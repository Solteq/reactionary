import { z } from 'zod';
import { CartIdentifierSchema, CartItemIdentifierSchema, IdentityIdentifierSchema, PaymentInstructionIdentifierSchema, ProductIdentifierSchema, SKUIdentifierSchema } from '../models/identifiers.model';
import { BaseModelSchema } from './base.model';
import { AddressSchema } from './profile.model';
import { ShippingMethodSchema } from './shipping-method.model';

import { CostBreakDownSchema, ItemCostBreakdownSchema } from './cost.model';
import { PaymentInstructionSchema } from './payment.model';

export const OrderStatusSchema = z.enum(['AwaitingPayment', 'ReleasedToFulfillment', 'Shipped', 'Cancelled']).default('AwaitingPayment').describe('The current status of the order.');
export const OrderInventoryStatusSchema = z.enum(['NotAllocated', 'Allocated', 'Backordered', 'Preordered']).default('Allocated').describe('The inventory release status of the order.');


export const OrderItemSchema = z.looseObject({
    identifier: CartItemIdentifierSchema.default(() => CartItemIdentifierSchema.parse({})),
    sku: SKUIdentifierSchema.default(() => SKUIdentifierSchema.parse({})),
    quantity: z.number().default(0),
    price: ItemCostBreakdownSchema.default(() => ItemCostBreakdownSchema.parse({})),

    inventoryStatus: OrderInventoryStatusSchema.default('Allocated').describe('The inventory release status of the order item.'),
});

export const OrderSchema = BaseModelSchema.extend({
    identifier: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({})),

    userId: IdentityIdentifierSchema.default(() => IdentityIdentifierSchema.parse({})),

    items: z.array(OrderItemSchema).default(() => []),
    price: CostBreakDownSchema.default(() => CostBreakDownSchema.parse({})),
    name: z.string().default(''),
    description: z.string().default(''),

    shippingAddress: AddressSchema.optional(),
    billingAddress: AddressSchema.optional(),
    shippingMethod: ShippingMethodSchema.optional(),

    orderStatus: OrderStatusSchema.default('AwaitingPayment'),
    inventoryStatus: OrderInventoryStatusSchema.default('Allocated'),

    paymentInstructions: z.array(PaymentInstructionSchema).default(() => []),
    cartReference: CartIdentifierSchema.optional().describe('Reference to the cart from which this order was created.'),
});



export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof OrderSchema>;
