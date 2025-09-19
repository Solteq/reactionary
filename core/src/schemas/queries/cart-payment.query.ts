import z from "zod";
import { CartIdentifierSchema } from "../models/identifiers.model";
import { PaymentStatusSchema } from "../models/payment.model";
import { BaseQuerySchema } from "./base.query";


export const CartPaymentQueryByCartSchema = BaseQuerySchema.extend({
    cart: CartIdentifierSchema.required(),
    status: z.array(PaymentStatusSchema).optional().describe('Optional status to filter payment instructions by'),
});

export type CartPaymentQueryByCart = z.infer<typeof CartPaymentQueryByCartSchema>;
