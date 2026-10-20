import * as z from 'zod';

/**
 * Raw Magento sales order payloads (`/V1/orders`, `/V1/orders/{id}`,
 * `/V1/orders/items`, all admin scope), as the order and order search
 * factories read them.
 *
 * The interfaces are the public shape; the zod schemas next to them narrow an
 * `unknown` REST body into that shape. They are loose: Magento sends far more
 * fields than are listed, and those survive parsing untouched. `null` (which
 * Magento emits for some empty columns) is read as "absent", and numeric
 * strings as numbers.
 */

export interface MagentoOrderDetailAddress {
  entity_id?: number;
  address_type?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  street?: string[];
  city?: string;
  region?: string;
  region_code?: string;
  postcode?: string;
  country_id?: string;
  telephone?: string;
  email?: string;
}

export interface MagentoOrderDetailItem {
  item_id: number;
  sku: string;
  name?: string;
  product_type?: string;
  /** Set on the child rows of configurable and bundle lines. */
  parent_item_id?: number;
  qty_ordered?: number;
  qty_shipped?: number;
  qty_canceled?: number;
  qty_refunded?: number;
  /** Unit price, excluding tax. */
  price?: number;
  /** `price * qty_ordered`, before discounts. */
  row_total?: number;
  /** The discount on the whole row (all units). */
  discount_amount?: number;
}

export interface MagentoOrderDetailPayment {
  method?: string;
  amount_ordered?: number;
  amount_authorized?: number;
  amount_paid?: number;
  amount_refunded?: number;
  amount_canceled?: number;
  po_number?: string;
}

/**
 * Adobe Commerce B2B `company_order_attributes`. `vat_tax_id` is not part of
 * Magento's payload: `MagentoOrderCapability` attaches it from
 * `/V1/company/{company_id}`, since core identifies companies by tax id.
 */
export interface MagentoOrderCompanyAttributes {
  company_id?: number;
  company_name?: string;
  vat_tax_id?: string;
}

export interface MagentoOrderShippingAssignment {
  shipping?: { address?: MagentoOrderDetailAddress; method?: string };
}

export interface MagentoOrderDetail {
  entity_id: number;
  increment_id?: string;
  store_id?: number;
  quote_id?: number;
  customer_id?: number;
  /** 1 for guest orders, 0 otherwise. */
  customer_is_guest?: number;
  customer_email?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  customer_note?: string;
  status?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  order_currency_code?: string;
  grand_total?: number;
  subtotal?: number;
  shipping_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  shipping_description?: string;
  items?: MagentoOrderDetailItem[];
  billing_address?: MagentoOrderDetailAddress;
  payment?: MagentoOrderDetailPayment;
  extension_attributes?: {
    shipping_assignments?: MagentoOrderShippingAssignment[];
    company_order_attributes?: MagentoOrderCompanyAttributes;
  };
}

/** An entry of the admin order list; the list returns full orders. */
export type MagentoOrder = MagentoOrderDetail;
export type MagentoOrderAddress = MagentoOrderDetailAddress;

export interface MagentoOrderListResponse {
  items?: MagentoOrder[];
  total_count?: number;
  search_criteria?: { page_size?: number; current_page?: number };
}

function absentIfNull(value: unknown): unknown {
  return value === null ? undefined : value;
}

function numberIfNumeric(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return absentIfNull(value);
}

const OptionalStringSchema = z.preprocess(absentIfNull, z.string().optional());
const OptionalNumberSchema = z.preprocess(numberIfNumeric, z.number().optional());
const RequiredNumberSchema = z.preprocess(numberIfNumeric, z.number());
const OptionalFlagSchema = z.preprocess(
  (value) => (typeof value === 'boolean' ? Number(value) : numberIfNumeric(value)),
  z.number().optional(),
);

export const MagentoOrderDetailAddressSchema = z.looseObject({
  entity_id: OptionalNumberSchema,
  address_type: OptionalStringSchema,
  firstname: OptionalStringSchema,
  lastname: OptionalStringSchema,
  company: OptionalStringSchema,
  street: z.preprocess(absentIfNull, z.array(z.string()).optional()),
  city: OptionalStringSchema,
  region: OptionalStringSchema,
  region_code: OptionalStringSchema,
  postcode: OptionalStringSchema,
  country_id: OptionalStringSchema,
  telephone: OptionalStringSchema,
  email: OptionalStringSchema,
}) satisfies z.ZodType<MagentoOrderDetailAddress>;

export const MagentoOrderDetailItemSchema = z.looseObject({
  item_id: RequiredNumberSchema,
  sku: z.string(),
  name: OptionalStringSchema,
  product_type: OptionalStringSchema,
  parent_item_id: OptionalNumberSchema,
  qty_ordered: OptionalNumberSchema,
  qty_shipped: OptionalNumberSchema,
  qty_canceled: OptionalNumberSchema,
  qty_refunded: OptionalNumberSchema,
  price: OptionalNumberSchema,
  row_total: OptionalNumberSchema,
  discount_amount: OptionalNumberSchema,
}) satisfies z.ZodType<MagentoOrderDetailItem>;

export const MagentoOrderDetailPaymentSchema = z.looseObject({
  method: OptionalStringSchema,
  amount_ordered: OptionalNumberSchema,
  amount_authorized: OptionalNumberSchema,
  amount_paid: OptionalNumberSchema,
  amount_refunded: OptionalNumberSchema,
  amount_canceled: OptionalNumberSchema,
  po_number: OptionalStringSchema,
}) satisfies z.ZodType<MagentoOrderDetailPayment>;

export const MagentoOrderCompanyAttributesSchema = z.looseObject({
  company_id: OptionalNumberSchema,
  company_name: OptionalStringSchema,
  vat_tax_id: OptionalStringSchema,
}) satisfies z.ZodType<MagentoOrderCompanyAttributes>;

export const MagentoOrderDetailSchema = z.looseObject({
  entity_id: RequiredNumberSchema,
  increment_id: OptionalStringSchema,
  store_id: OptionalNumberSchema,
  quote_id: OptionalNumberSchema,
  customer_id: OptionalNumberSchema,
  customer_is_guest: OptionalFlagSchema,
  customer_email: OptionalStringSchema,
  customer_firstname: OptionalStringSchema,
  customer_lastname: OptionalStringSchema,
  customer_note: OptionalStringSchema,
  status: OptionalStringSchema,
  state: OptionalStringSchema,
  created_at: OptionalStringSchema,
  updated_at: OptionalStringSchema,
  order_currency_code: OptionalStringSchema,
  grand_total: OptionalNumberSchema,
  subtotal: OptionalNumberSchema,
  shipping_amount: OptionalNumberSchema,
  discount_amount: OptionalNumberSchema,
  tax_amount: OptionalNumberSchema,
  shipping_description: OptionalStringSchema,
  items: z.preprocess(absentIfNull, z.array(MagentoOrderDetailItemSchema).optional()),
  billing_address: z.preprocess(absentIfNull, MagentoOrderDetailAddressSchema.optional()),
  payment: z.preprocess(absentIfNull, MagentoOrderDetailPaymentSchema.optional()),
  extension_attributes: z.preprocess(
    absentIfNull,
    z
      .looseObject({
        shipping_assignments: z.preprocess(
          absentIfNull,
          z
            .array(
              z.looseObject({
                shipping: z.preprocess(
                  absentIfNull,
                  z
                    .looseObject({
                      address: z.preprocess(absentIfNull, MagentoOrderDetailAddressSchema.optional()),
                      method: OptionalStringSchema,
                    })
                    .optional(),
                ),
              }),
            )
            .optional(),
        ),
        company_order_attributes: z.preprocess(
          absentIfNull,
          MagentoOrderCompanyAttributesSchema.optional(),
        ),
      })
      .optional(),
  ),
}) satisfies z.ZodType<MagentoOrderDetail>;

export const MagentoOrderListResponseSchema = z.looseObject({
  items: z.preprocess(absentIfNull, z.array(MagentoOrderDetailSchema).optional()),
  total_count: OptionalNumberSchema,
  search_criteria: z.preprocess(
    absentIfNull,
    z
      .looseObject({
        page_size: OptionalNumberSchema,
        current_page: OptionalNumberSchema,
      })
      .optional(),
  ),
}) satisfies z.ZodType<MagentoOrderListResponse>;

/** `GET /V1/orders?fields=items[entity_id],total_count`: ids only. */
export const MagentoOrderIdListSchema = z.looseObject({
  items: z.preprocess(
    absentIfNull,
    z.array(z.looseObject({ entity_id: RequiredNumberSchema })).optional(),
  ),
  total_count: OptionalNumberSchema,
});

export type MagentoOrderIdList = z.output<typeof MagentoOrderIdListSchema>;

/** `GET /V1/orders/items?fields=items[order_id,sku],total_count`. */
export const MagentoOrderItemSkuListSchema = z.looseObject({
  items: z.preprocess(
    absentIfNull,
    z.array(z.looseObject({ order_id: RequiredNumberSchema, sku: z.string() })).optional(),
  ),
  total_count: OptionalNumberSchema,
});

export type MagentoOrderItemSkuList = z.output<typeof MagentoOrderItemSkuListSchema>;

/** The slice of Adobe Commerce B2B's `/V1/company/{id}` the order reads. */
export const MagentoOrderCompanySchema = z.looseObject({
  id: OptionalNumberSchema,
  company_name: OptionalStringSchema,
  vat_tax_id: OptionalStringSchema,
});

export type MagentoOrderCompany = z.output<typeof MagentoOrderCompanySchema>;
