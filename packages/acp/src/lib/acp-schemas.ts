import * as z from 'zod';

export const ACPItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.int().min(1),
});

export const ACPBuyerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  phone_number: z.string().optional(),
});

export const ACPAddressSchema = z.object({
  name: z.string().min(1),
  line_one: z.string().min(1),
  line_two: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  postal_code: z.string().min(1),
  phone_number: z.string().optional(),
});

export const ACPCreateCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  items: z.array(ACPItemSchema).min(1),
  fulfillment_address: ACPAddressSchema.optional(),
});

export const ACPUpdateCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  items: z.array(ACPItemSchema).min(1).optional(),
  fulfillment_address: ACPAddressSchema.optional(),
  fulfillment_option_id: z.string().optional(),
});

export const ACPPaymentDataSchema = z.object({
  token: z.string().min(1),
  provider: z.enum(['stripe', 'adyen', 'braintree']),
  billing_address: ACPAddressSchema.optional(),
});

export const ACPCompleteCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  payment_data: ACPPaymentDataSchema,
});

export const ACPCheckoutSessionStateSchema = z.looseObject({
  id: z.string(),
  cartId: z.string(),
  checkoutId: z.string(),
  status: z.enum([
    'not_ready_for_payment',
    'ready_for_payment',
    'completed',
    'canceled',
  ]),
  buyer: ACPBuyerSchema.optional(),
  fulfillmentAddress: ACPAddressSchema.optional(),
  fulfillmentOptionId: z.string().optional(),
  orderId: z.string().optional(),
});

export type ACPItem = z.infer<typeof ACPItemSchema>;
export type ACPBuyer = z.infer<typeof ACPBuyerSchema>;
export type ACPAddress = z.infer<typeof ACPAddressSchema>;
export type ACPCreateCheckoutSessionRequest = z.infer<
  typeof ACPCreateCheckoutSessionRequestSchema
>;
export type ACPUpdateCheckoutSessionRequest = z.infer<
  typeof ACPUpdateCheckoutSessionRequestSchema
>;
export type ACPCompleteCheckoutSessionRequest = z.infer<
  typeof ACPCompleteCheckoutSessionRequestSchema
>;
export type ACPPaymentData = z.infer<typeof ACPPaymentDataSchema>;
export type ACPCheckoutSessionState = z.infer<
  typeof ACPCheckoutSessionStateSchema
>;
