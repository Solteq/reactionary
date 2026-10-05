import { CurrencySchema } from '@reactionary/core';
import * as z from 'zod';
import { ACPDiscountsRequestSchema, ACPRejectedDiscountSchema } from './acp-discounts.js';

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
});

export const ACPFulfillmentDetailsSchema = z.object({
  name: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.email().optional(),
  address: ACPAddressSchema.optional(),
});

export const ACPSelectedFulfillmentOptionSchema = z.object({
  type: z.enum(['shipping', 'digital', 'pickup', 'local_delivery']),
  option_id: z.string().min(1),
  item_ids: z.array(z.string()),
});

export const ACP_INTERVENTION_TYPES = ['3ds', 'biometric', 'address_verification'] as const;
export type ACPInterventionType = (typeof ACP_INTERVENTION_TYPES)[number];

/**
 * The agent's declared capabilities. Unknown values are ignored rather than
 * rejected (capability negotiation RFC §4.6.2).
 */
export const ACPAgentCapabilitiesSchema = z.object({
  interventions: z.object({
    supported: z.array(z.string()).optional(),
    display_context: z.string().optional(),
    redirect_context: z.string().optional(),
    max_redirects: z.int().min(0).optional(),
    max_interaction_depth: z.int().min(1).optional(),
  }).optional(),
  extensions: z.array(z.string()).optional(),
});

export const ACPCreateCheckoutSessionRequestSchema = z.object({
  capabilities: ACPAgentCapabilitiesSchema,
  discounts: ACPDiscountsRequestSchema.optional(),
  /** Deprecated alias of `discounts.codes`. */
  coupons: z.array(z.string().min(1)).optional(),
  buyer: ACPBuyerSchema.optional(),
  line_items: z.array(ACPItemSchema).min(1),
  currency: z.string().refine(
    (currency) => CurrencySchema.safeParse(currency.toUpperCase()).success,
    'Expected an ISO 4217 currency code',
  ),
  fulfillment_details: ACPFulfillmentDetailsSchema.optional(),
});

export const ACPUpdateCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  line_items: z.array(ACPItemSchema).min(1).optional(),
  discounts: ACPDiscountsRequestSchema.optional(),
  /** Deprecated alias of `discounts.codes`. */
  coupons: z.array(z.string().min(1)).optional(),
  // null clears the field; absent leaves it unchanged.
  fulfillment_details: ACPFulfillmentDetailsSchema.nullable().optional(),
  selected_fulfillment_options: z.array(ACPSelectedFulfillmentOptionSchema).nullable().optional(),
});

/**
 * Payment data on completion: the instrument a payment handler produced,
 * e.g. `{ type: 'card', credential: { type: 'spt', token: 'spt_...' } }`.
 * Purchase-order payments (B2B) are not supported, so the handler and
 * instrument are required.
 */
export const ACPPaymentDataSchema = z.object({
  handler_id: z.string().min(1),
  instrument: z.object({
    type: z.string().min(1),
    credential: z.looseObject({
      type: z.string().min(1),
      token: z.string().min(1),
    }),
  }),
  billing_address: ACPAddressSchema.optional(),
});

/** Seller-provided metadata the agent authenticates the buyer (3DS) with. */
export const ACPAuthenticationMetadataSchema = z.looseObject({
  channel: z.looseObject({}).optional(),
  acquirer_details: z.object({
    acquirer_bin: z.string().max(11),
    acquirer_country: z.string().length(2),
    acquirer_merchant_id: z.string().max(35),
    merchant_name: z.string().max(40),
    requestor_id: z.string().max(35).optional(),
  }),
  directory_server: z.enum(['american_express', 'mastercard', 'visa']),
  flow_preference: z.object({
    type: z.enum(['challenge', 'frictionless']),
    challenge: z.object({ type: z.enum(['mandated', 'preferred']).optional() }).optional(),
    frictionless: z.object({ type: z.enum(['low_risk']).optional() }).optional(),
  }).optional(),
});

/** Outcomes after which the payment may be authorized with the result. */
export const ACP_AUTHENTICATED_OUTCOMES = ['authenticated', 'attempt_acknowledged', 'informational'] as const;

export const ACPAuthenticationResultSchema = z.object({
  outcome: z.enum([
    'abandoned',
    'attempt_acknowledged',
    'authenticated',
    'canceled',
    'denied',
    'informational',
    'internal_error',
    'not_supported',
    'processing_error',
    'rejected',
  ]),
  outcome_details: z.object({
    three_ds_cryptogram: z.string(),
    electronic_commerce_indicator: z.enum(['01', '02', '05', '06', '07']),
    transaction_id: z.string(),
    version: z.string(),
  }).optional(),
}).refine(
  (result) => result.outcome_details !== undefined
    || !(ACP_AUTHENTICATED_OUTCOMES as readonly string[]).includes(result.outcome),
  { error: 'outcome_details is required for this outcome', path: ['outcome_details'] },
);

export const ACPCompleteCheckoutSessionRequestSchema = z.object({
  buyer: ACPBuyerSchema.optional(),
  payment_data: ACPPaymentDataSchema,
  authentication_result: ACPAuthenticationResultSchema.optional(),
});

export const ACP_INTENT_TRACE_REASON_CODES = [
  'price_sensitivity',
  'shipping_cost',
  'shipping_speed',
  'product_fit',
  'trust_security',
  'returns_policy',
  'payment_options',
  'comparison',
  'timing_deferred',
  'other',
] as const;

/**
 * Why an agent abandons a session (intent traces RFC). Unknown reason codes
 * are accepted and treated as `other`; metadata is a flat map.
 */
export const ACPIntentTraceSchema = z.object({
  reason_code: z.string().min(1).transform((code) =>
    (ACP_INTENT_TRACE_REASON_CODES as readonly string[]).includes(code) ? code : 'other'),
  trace_summary: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const ACPCancelCheckoutSessionRequestSchema = z.object({
  intent_trace: ACPIntentTraceSchema.optional(),
});

export type ACPIntentTrace = z.output<typeof ACPIntentTraceSchema>;
export type ACPCancelCheckoutSessionRequest = z.output<typeof ACPCancelCheckoutSessionRequestSchema>;

export const ACPCheckoutSessionStateSchema = z.looseObject({
  id: z.string(),
  // The ACP session owning the backend cart, resumed for later requests.
  sessionId: z.string().optional(),
  /** The authenticated agent that created the session and may access it. */
  agentId: z.string().optional(),
  cartId: z.string(),
  /** What the agent declared on creation; capabilities are write-only. */
  agentCapabilities: ACPAgentCapabilitiesSchema.optional(),
  /** ISO 4217 currency requested on creation, lower case. */
  currency: z.string().optional(),
  // Set once completion has created the real reactionary checkout.
  checkoutId: z.string().optional(),
  status: z.enum([
    'not_ready_for_payment',
    'ready_for_payment',
    'authentication_required',
    'in_progress',
    'complete_in_progress',
    'completed',
    'canceled',
  ]),
  buyer: ACPBuyerSchema.optional(),
  /** Why the agent canceled the session; write-only, never returned. */
  intentTrace: z.looseObject({
    reason_code: z.string(),
    trace_summary: z.string().optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }).optional(),
  /** Discount codes submitted (discount extension) and those rejected. */
  discountCodes: z.array(z.string()).optional(),
  rejectedDiscounts: z.array(ACPRejectedDiscountSchema).optional(),
  /** The 3DS metadata the session awaits an authentication result for. */
  authenticationMetadata: ACPAuthenticationMetadataSchema.optional(),
  fulfillmentDetails: ACPFulfillmentDetailsSchema.optional(),
  // The backend checkout has one shipping method, so one option is kept.
  fulfillmentOptionId: z.string().optional(),
  orderId: z.string().optional(),
});

/** An order placed through an ACP checkout session, kept for order events. */
export const ACPOrderRecordSchema = z.looseObject({
  id: z.string(),
  checkoutSessionId: z.string(),
  /** The ACP session that placed the order; backends scope orders to it. */
  sessionId: z.string().optional(),
  /** The agent that placed the order, whose webhook receives its events. */
  agentId: z.string().optional(),
});

export type ACPOrderRecord = z.infer<typeof ACPOrderRecordSchema>;
export type ACPItem = z.infer<typeof ACPItemSchema>;
export type ACPAuthenticationMetadata = z.infer<typeof ACPAuthenticationMetadataSchema>;
export type ACPAuthenticationResult = z.infer<typeof ACPAuthenticationResultSchema>;
export type ACPAgentCapabilities = z.infer<typeof ACPAgentCapabilitiesSchema>;
export type ACPBuyer = z.infer<typeof ACPBuyerSchema>;
export type ACPAddress = z.infer<typeof ACPAddressSchema>;
export type ACPFulfillmentDetails = z.infer<typeof ACPFulfillmentDetailsSchema>;
export type ACPSelectedFulfillmentOption = z.infer<typeof ACPSelectedFulfillmentOptionSchema>;
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
