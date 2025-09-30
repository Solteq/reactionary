import z from "zod";
import { OrderIdentifierSchema } from "../models/identifiers.model";
import { PaymentStatusSchema } from "../models/payment.model";
import { BaseQuerySchema } from "./base.query";


export const OrderPaymentQueryByOrderSchema = BaseQuerySchema.extend({
    order: OrderIdentifierSchema.required(),
    status: z.array(PaymentStatusSchema).optional().describe('Optional status to filter payment instructions by'),
});

export type OrderPaymentQueryByOrder = z.infer<typeof OrderPaymentQueryByOrderSchema>;
