import type { z } from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { CheckoutIdentifierSchema } from '../models/identifiers.model.js';

export const CheckoutQueryByIdSchema = BaseQuerySchema.extend({
    identifier: CheckoutIdentifierSchema
});

export const CheckoutQueryForAvailableShippingMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema
});

export const CheckoutQueryForAvailablePaymentMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema
});

export type CheckoutQueryForAvailableShippingMethods = z.infer<typeof CheckoutQueryForAvailableShippingMethodsSchema>;
export type CheckoutQueryForAvailablePaymentMethods = z.infer<typeof CheckoutQueryForAvailablePaymentMethodsSchema>;
export type CheckoutQueryById = z.infer<typeof CheckoutQueryByIdSchema>;
