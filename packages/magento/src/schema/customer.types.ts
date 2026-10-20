import * as z from 'zod';
import type {
  MagentoCustomAttribute,
  MagentoCustomerAddressData,
  MagentoCustomerData,
} from './magento.types.js';

/**
 * A customer address as returned and accepted by `/V1/customers/me`,
 * including the address-level custom attributes Magento sends along.
 */
export interface MagentoAddress extends MagentoCustomerAddressData {
  custom_attributes?: MagentoCustomAttribute[];
}

/**
 * The `/V1/customers/me` payload as the profile capability works with it.
 * `confirmation` is the pending e-mail confirmation key: Magento leaves it
 * unset (or null) once the address is confirmed.
 */
export interface MagentoCustomer extends Omit<MagentoCustomerData, 'addresses'> {
  confirmation?: string | null;
  addresses?: MagentoAddress[];
}

const MagentoCustomAttributeSchema = z.looseObject({
  attribute_code: z.string(),
  value: z.unknown(),
});

const OptionalStringSchema = z.string().nullish().transform((v) => v ?? undefined);
const OptionalNumberSchema = z.number().nullish().transform((v) => v ?? undefined);
const OptionalBooleanSchema = z.boolean().nullish().transform((v) => v ?? undefined);
/** Magento renders ids as numbers in some versions and strings in others. */
const OptionalIdSchema = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === null || v === undefined ? undefined : String(v)));

export const MagentoAddressPayloadSchema = z.looseObject({
  id: OptionalNumberSchema,
  customer_id: OptionalNumberSchema,
  company: OptionalStringSchema,
  firstname: OptionalStringSchema,
  lastname: OptionalStringSchema,
  street: z.array(z.string()).nullish().transform((v) => v ?? undefined),
  city: OptionalStringSchema,
  region: z
    .looseObject({
      region_code: OptionalStringSchema,
      region: OptionalStringSchema,
      region_id: OptionalNumberSchema,
    })
    .nullish()
    .transform((v) => v ?? undefined),
  region_id: OptionalNumberSchema,
  postcode: OptionalStringSchema,
  country_id: OptionalStringSchema,
  telephone: OptionalStringSchema,
  default_billing: OptionalBooleanSchema,
  default_shipping: OptionalBooleanSchema,
  custom_attributes: z
    .array(MagentoCustomAttributeSchema)
    .nullish()
    .transform((v) => v ?? undefined),
});

/**
 * Validates a `/V1/customers/me` payload received as `unknown` (factories
 * accept untyped data), so the mapping needs no unchecked casts.
 */
export const MagentoCustomerPayloadSchema = z.looseObject({
  id: z.number(),
  email: z.string(),
  firstname: OptionalStringSchema,
  lastname: OptionalStringSchema,
  confirmation: z.string().nullish(),
  default_billing: OptionalIdSchema,
  default_shipping: OptionalIdSchema,
  created_at: OptionalStringSchema,
  updated_at: OptionalStringSchema,
  addresses: z
    .array(MagentoAddressPayloadSchema)
    .nullish()
    .transform((v) => v ?? undefined),
  custom_attributes: z
    .array(MagentoCustomAttributeSchema)
    .nullish()
    .transform((v) => v ?? undefined),
});

export type MagentoCustomerPayload = z.output<typeof MagentoCustomerPayloadSchema>;
export type MagentoAddressPayload = z.output<typeof MagentoAddressPayloadSchema>;

export const MagentoDirectoryCountrySchema = z.looseObject({
  id: z.string(),
  available_regions: z
    .array(
      z.looseObject({
        id: z.union([z.string(), z.number()]).transform(String),
        code: z.string().nullish().transform((v) => v ?? ''),
        name: z.string().nullish().transform((v) => v ?? ''),
      }),
    )
    .nullish()
    .transform((v) => v ?? []),
});

export type MagentoDirectoryCountry = z.output<typeof MagentoDirectoryCountrySchema>;
export type MagentoDirectoryRegion = MagentoDirectoryCountry['available_regions'][number];
