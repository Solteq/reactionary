import { CurrencySchema } from '@reactionary/core';
import * as z from 'zod';

/**
 * A requested item. The 2026-04-17 Item schema carries no quantity, while the
 * checkout RFC still sends one; it is accepted as an optional decimal
 * (B2B fractional units) and defaults to 1. Repeated ids add up.
 */
export const ACPItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().positive().optional(),
  name: z.string().optional(),
  unit_amount: z.int().optional(),
});

export const ACPCompanyInfoSchema = z.object({
  name: z.string().min(1),
  tax_id: z.string().optional(),
  department: z.string().optional(),
  cost_center: z.string().optional(),
});

export const ACPLoyaltyInfoSchema = z.object({
  tier: z.string().optional(),
  points_balance: z.int().optional(),
  member_since: z.string().optional(),
});

export const ACPTaxExemptionSchema = z.object({
  certificate_id: z.string().min(1),
  certificate_type: z.enum(['resale', 'exempt_organization', 'government']),
  exempt_regions: z.array(z.string()).optional(),
  expires_at: z.string().optional(),
});

/** The 2026-04-17 Buyer: only the email is required. */
export const ACPBuyerSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name: z.string().optional(),
  email: z.email(),
  phone_number: z.string().optional(),
  customer_id: z.string().optional(),
  account_type: z.enum(['guest', 'registered', 'business']).optional(),
  authentication_status: z.enum(['authenticated', 'guest', 'requires_signin']).optional(),
  company: ACPCompanyInfoSchema.optional(),
  loyalty: ACPLoyaltyInfoSchema.optional(),
  tax_exemption: ACPTaxExemptionSchema.optional(),
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
  line_items: z.array(ACPItemSchema).min(1),
  currency: z.string().refine(
    (currency) => CurrencySchema.safeParse(currency.toUpperCase()).success,
    'Expected an ISO 4217 currency code',
  ),
  fulfillment_address: ACPAddressSchema.optional(),
});

export const ACPUpdateCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  line_items: z.array(ACPItemSchema).min(1).optional(),
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
  // The ACP session owning the backend cart, resumed for later requests.
  sessionId: z.string().optional(),
  cartId: z.string(),
  /** ISO 4217 currency requested on creation, lower case. */
  currency: z.string().optional(),
  // Set once completion has created the real reactionary checkout.
  checkoutId: z.string().optional(),
  status: z.enum([
    'not_ready_for_payment',
    'ready_for_payment',
    'in_progress',
    'completed',
    'canceled',
  ]),
  buyer: ACPBuyerSchema.optional(),
  fulfillmentAddress: ACPAddressSchema.optional(),
  fulfillmentOptionId: z.string().optional(),
  orderId: z.string().optional(),
});

export const ACPDescriptionSchema = z.object({
  plain: z.string().optional(),
  html: z.string().optional(),
  markdown: z.string().optional(),
});

export const ACPMediaSchema = z.object({
  url: z.string(),
  alt_text: z.string().optional(),
});

export const ACPFeedPriceSchema = z.object({
  amount: z.int(),
  currency: z.string().length(3),
});

export const ACPAvailabilitySchema = z.object({
  available: z.boolean().optional(),
  status: z.string().optional(),
});

export const ACPBarcodeSchema = z.object({
  type: z.string(),
  value: z.string(),
});

export const ACPVariantOptionSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const ACPFeedVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: ACPDescriptionSchema.optional(),
  url: z.string().optional(),
  barcodes: z.array(ACPBarcodeSchema).optional(),
  price: ACPFeedPriceSchema.optional(),
  list_price: ACPFeedPriceSchema.optional(),
  availability: ACPAvailabilitySchema.optional(),
  variant_options: z.array(ACPVariantOptionSchema).optional(),
  media: z.array(ACPMediaSchema).optional(),
});

export const ACPFeedProductSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: ACPDescriptionSchema.optional(),
  url: z.string().optional(),
  media: z.array(ACPMediaSchema).optional(),
  variants: z.array(ACPFeedVariantSchema).min(1),
});

export const ACPProductFeedResponseSchema = z.object({
  target_country: z.string().length(2).optional(),
  products: z.array(ACPFeedProductSchema),
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
export type ACPFeedProduct = z.infer<typeof ACPFeedProductSchema>;
export type ACPFeedVariant = z.infer<typeof ACPFeedVariantSchema>;
export type ACPProductFeedResponse = z.infer<typeof ACPProductFeedResponseSchema>;
