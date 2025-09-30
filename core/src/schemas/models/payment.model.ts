import { z } from 'zod';
import { BaseModelSchema, ImageSchema } from './base.model';
import { CartIdentifierSchema, OrderIdentifierSchema, PaymentInstructionIdentifierSchema, PaymentMethodIdentifierSchema } from './identifiers.model';
import { MonetaryAmountSchema } from './price.model';

export const PaymentStatusSchema = z.enum(['pending', 'authorized', 'canceled', 'capture', 'partial_capture', 'refunded', 'partial_refund']);

export const PaymentProtocolDataSchema = z.looseObject({
    key: z.string().default(''),
    value: z.string().default(''),
});


export const PaymentMethodSchema = BaseModelSchema.extend({
    identifier: PaymentMethodIdentifierSchema.default(() => PaymentMethodIdentifierSchema.parse({})),
    logo: ImageSchema.optional(),
    description: z.string().default(''),
    isPunchOut: z.boolean().default(true)
});

export const PaymentInstructionSchema = BaseModelSchema.extend({
    identifier: PaymentInstructionIdentifierSchema.default(() => PaymentInstructionIdentifierSchema.parse({})),
    amount: MonetaryAmountSchema.default(() => MonetaryAmountSchema.parse({})),
    paymentMethod: PaymentMethodIdentifierSchema.default(() => PaymentMethodIdentifierSchema.parse({})),
    protocolData: z.array(PaymentProtocolDataSchema).default(() => []).describe('Additional protocol-specific data for processing the payment.'),
    status: PaymentStatusSchema.default('pending'),
});


export const CartPaymentInstructionSchema = PaymentInstructionSchema.extend({
    cart: CartIdentifierSchema.default(() => CartIdentifierSchema.parse({}))
});

export const OrderPaymentInstructionSchema = PaymentInstructionSchema.extend({
    order: OrderIdentifierSchema.default(() => OrderIdentifierSchema.parse({}))
});

export type CartPaymentInstruction = z.infer<typeof CartPaymentInstructionSchema>;
export type OrderPaymentInstruction = z.infer<typeof OrderPaymentInstructionSchema>;
export type PaymentInstruction = z.infer<typeof PaymentInstructionSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
