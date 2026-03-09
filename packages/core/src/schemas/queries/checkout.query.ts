import type * as z from 'zod';
import { BaseQuerySchema } from './base.query.js';
import { CheckoutIdentifierSchema } from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const CheckoutQueryByIdSchema = BaseQuerySchema.extend({
    identifier: CheckoutIdentifierSchema
});

export const CheckoutQueryForAvailableShippingMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema
});

export const CheckoutQueryForAvailablePaymentMethodsSchema = BaseQuerySchema.extend({
    checkout: CheckoutIdentifierSchema
});

export type CheckoutQueryForAvailableShippingMethods = InferType<typeof CheckoutQueryForAvailableShippingMethodsSchema>;
export type CheckoutQueryForAvailablePaymentMethods = InferType<typeof CheckoutQueryForAvailablePaymentMethodsSchema>;
export type CheckoutQueryById = InferType<typeof CheckoutQueryByIdSchema>;
