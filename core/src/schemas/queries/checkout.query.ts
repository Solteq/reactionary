import type { z } from 'zod';
import { BaseQuerySchema } from './base.query';
import { CartIdentifierSchema, CheckoutIdentifierSchema } from '../models/identifiers.model';

export const CheckoutQueryByIdSchema = BaseQuerySchema.extend({
    identifier: CheckoutIdentifierSchema.required()
});


export const CheckoutQueryForAvailableShippingMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema.required()
});

export const CheckoutQueryForAvailablePaymentMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema.required()
});



export type CheckoutQueryForAvailableShippingMethods = z.infer<typeof CheckoutQueryForAvailableShippingMethodsSchema>;
export type CheckoutQueryForAvailablePaymentMethods = z.infer<typeof CheckoutQueryForAvailablePaymentMethodsSchema>;
export type CheckoutQueryById = z.infer<typeof CheckoutQueryByIdSchema>;
