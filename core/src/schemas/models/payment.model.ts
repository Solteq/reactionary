import * as z from 'zod';
import { BaseModelSchema, ImageSchema } from './base.model.js';
import { PaymentInstructionIdentifierSchema, PaymentMethodIdentifierSchema } from './identifiers.model.js';
import { MonetaryAmountSchema } from './price.model.js';
import type { InferType } from '../../zod-utils.js';

export const PaymentStatusSchema = z.enum(['pending', 'authorized', 'canceled', 'capture', 'partial_capture', 'refunded', 'partial_refund']);

export const PaymentProtocolDataSchema = z.looseObject({
    key: z.string(),
    value: z.string(),
});

export const PaymentMethodSchema = BaseModelSchema.extend({
    identifier: PaymentMethodIdentifierSchema,
    logo: ImageSchema.optional(),
    description: z.string(),
    isPunchOut: z.boolean()
});

export const PaymentInstructionSchema = BaseModelSchema.extend({
    identifier: PaymentInstructionIdentifierSchema,
    amount: MonetaryAmountSchema,
    paymentMethod: PaymentMethodIdentifierSchema,
    protocolData: z.array(PaymentProtocolDataSchema).meta({ description: 'Additional protocol-specific data for processing the payment.' }),
    status: PaymentStatusSchema,
});

export type PaymentInstruction = InferType<typeof PaymentInstructionSchema>;
export type PaymentStatus = InferType<typeof PaymentStatusSchema>;
export type PaymentMethod = InferType<typeof PaymentMethodSchema>;
