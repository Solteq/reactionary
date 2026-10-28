import * as z from 'zod';

/*
 * Request bodies arrive from unauthenticated agents, so the handlers only rely
 * on the parts of the generated UCP types that were actually validated here.
 * The schemas are loose objects: fields the handlers do not read, including
 * extension fields, pass through untouched.
 */

export const UCPPostalAddressRequestSchema = z.looseObject({
  id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  street_address: z.string().optional(),
  extended_address: z.string().optional(),
  address_locality: z.string().optional(),
  address_region: z.string().optional(),
  address_country: z.string().optional(),
  postal_code: z.string().optional(),
  phone_number: z.string().optional(),
});

export const UCPLineItemRequestSchema = z.looseObject({
  item: z.looseObject({ id: z.string() }),
  quantity: z.int().min(1),
});

export type UCPLineItemRequest = z.infer<typeof UCPLineItemRequestSchema>;

export const UCPCartRequestSchema = z.looseObject({
  line_items: z.array(UCPLineItemRequestSchema),
});

export type UCPCartRequest = z.infer<typeof UCPCartRequestSchema>;

export const UCPPaymentInstrumentRequestSchema = z.looseObject({
  id: z.string(),
  handler_id: z.string(),
  type: z.string(),
  selected: z.boolean().optional(),
  billing_address: UCPPostalAddressRequestSchema.optional(),
  credential: z.unknown().optional(),
});

export type UCPPaymentInstrumentRequest = z.infer<typeof UCPPaymentInstrumentRequestSchema>;

/**
 * The discount and fulfillment extensions are not part of the generated base
 * schema; they are read leniently by the checkout session itself.
 */
export const UCPCheckoutRequestSchema = z.looseObject({
  cart_id: z.string().optional(),
  line_items: z.array(UCPLineItemRequestSchema).optional(),
  buyer: z.looseObject({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone_number: z.string().optional(),
  }).optional(),
  payment: z.looseObject({
    instruments: z.array(UCPPaymentInstrumentRequestSchema).optional(),
  }).optional(),
});

export type UCPCheckoutRequest = z.infer<typeof UCPCheckoutRequestSchema>;

export const UCPCatalogSearchRequestSchema = z.looseObject({
  query: z.string().optional(),
  filters: z.looseObject({
    categories: z.array(z.string()).optional(),
    price: z.unknown().optional(),
  }).optional(),
  pagination: z.looseObject({
    limit: z.int().min(1).optional(),
    cursor: z.string().optional(),
  }).optional(),
});

export type UCPCatalogSearchRequest = z.infer<typeof UCPCatalogSearchRequestSchema>;

export const UCPCatalogLookupRequestSchema = z.looseObject({
  ids: z.array(z.string()),
});

export type UCPCatalogLookupRequest = z.infer<typeof UCPCatalogLookupRequestSchema>;

export const UCPCatalogGetProductRequestSchema = z.looseObject({
  id: z.string().optional(),
});

export type UCPCatalogGetProductRequest = z.infer<typeof UCPCatalogGetProductRequestSchema>;
