import * as z from 'zod';

/**
 * Payload schemas for the Adobe Commerce B2B company module, as returned by
 * the storefront GraphQL schema (`company`, `createCompany`,
 * `createCompanyUser`, ...) and, for registration status checks only, the
 * admin REST `GET /V1/company/:id` endpoint.
 *
 * GraphQL returns `null` for every unset optional field, so everything not
 * guaranteed by the schema is `nullish`. The payloads are parsed with these
 * schemas rather than cast, so a Magento without the B2B module (or with a
 * differently shaped response) fails loudly instead of yielding bad data.
 */

export const MagentoCompanyRegionSchema = z.looseObject({
  region: z.string().nullish(),
  region_code: z.string().nullish(),
  region_id: z.number().nullish(),
});

export const MagentoCompanyLegalAddressSchema = z.looseObject({
  street: z.array(z.string().nullable()).nullish(),
  city: z.string().nullish(),
  postcode: z.string().nullish(),
  country_code: z.string().nullish(),
  telephone: z.string().nullish(),
  region: MagentoCompanyRegionSchema.nullish(),
});

export const MagentoCompanyRoleSchema = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
});

export const MagentoCompanyUserStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

/** A company user is a `Customer` with the B2B company fields resolved. */
export const MagentoCompanyUserSchema = z.looseObject({
  id: z.string().nullish(),
  email: z.string().nullish(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  job_title: z.string().nullish(),
  telephone: z.string().nullish(),
  status: MagentoCompanyUserStatusSchema.nullish(),
  role: MagentoCompanyRoleSchema.nullish(),
});

export const MagentoCompanyAdminSchema = z.looseObject({
  id: z.string().nullish(),
  email: z.string().nullish(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
});

export const MagentoCompanySchema = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
  legal_name: z.string().nullish(),
  email: z.string().nullish(),
  vat_tax_id: z.string().nullish(),
  reseller_id: z.string().nullish(),
  legal_address: MagentoCompanyLegalAddressSchema.nullish(),
  company_admin: MagentoCompanyAdminSchema.nullish(),
});

/** `CompanyStatusEnum`, only exposed through `Customer.companies` (2.4.7+). */
export const MagentoCompanyStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'BLOCKED',
]);

/** `CompanyBasicInfo`: an entry of `Customer.companies` (2.4.7+). */
export const MagentoCompanyBasicInfoSchema = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
  legal_name: z.string().nullish(),
  status: MagentoCompanyStatusSchema.nullish(),
});

/** `SearchResultPageInfo`. */
export const MagentoCompanyPageInfoSchema = z.looseObject({
  current_page: z.number().nullish(),
  page_size: z.number().nullish(),
  total_pages: z.number().nullish(),
});

// --- Company address book (Adobe Commerce as a Cloud Service) -------------

export const MagentoCompanyAddressTypeSchema = z.enum(['BILLING', 'SHIPPING']);

/** `CompanyAddress`: an entry of the company address book. */
export const MagentoCompanyAddressSchema = z.looseObject({
  id: z.string(),
  nickname: z.string().nullish(),
  company_id: z.string().nullish(),
  address_type: MagentoCompanyAddressTypeSchema,
  is_default: z.boolean(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  company: z.string().nullish(),
  street: z.array(z.string().nullable()).nullish(),
  city: z.string().nullish(),
  country_code: z.string().nullish(),
  region_id: z.number().nullish(),
  region: MagentoCompanyRegionSchema.nullish(),
  postcode: z.string().nullish(),
  telephone: z.string().nullish(),
});

/** `CompanyConfig`: the company's address book settings. */
export const MagentoCompanyConfigSchema = z.looseObject({
  address_book_enabled: z.boolean(),
  address_book_custom_shipping_address_enabled: z.boolean(),
});

export const MagentoCompanyUsersSchema = z.looseObject({
  items: z.array(MagentoCompanyUserSchema.nullable()),
  total_count: z.number(),
});

// --- GraphQL response envelopes --------------------------------------------

export const MagentoCompanyResponseSchema = z.looseObject({
  company: MagentoCompanySchema.nullable(),
});

export const MagentoCompanyUsersResponseSchema = z.looseObject({
  company: MagentoCompanySchema.extend({
    users: MagentoCompanyUsersSchema.nullish(),
  }).nullable(),
});

export const MagentoCompanyUserResponseSchema = z.looseObject({
  company: MagentoCompanySchema.extend({
    user: MagentoCompanyUserSchema.nullish(),
  }).nullable(),
});

export const MagentoCompanyRolesResponseSchema = z.looseObject({
  company: z
    .looseObject({
      id: z.string(),
      roles: z.looseObject({
        items: z.array(MagentoCompanyRoleSchema.nullable()),
      }),
    })
    .nullable(),
});

export const MagentoCustomerCompaniesResponseSchema = z.looseObject({
  customer: z
    .looseObject({
      companies: z.looseObject({
        items: z.array(MagentoCompanyBasicInfoSchema.nullable()),
        page_info: MagentoCompanyPageInfoSchema.nullish(),
      }),
    })
    .nullable(),
});

export const MagentoCompanyAddressesResponseSchema = z.looseObject({
  company: z
    .looseObject({
      id: z.string(),
      config: MagentoCompanyConfigSchema,
      addresses: z.looseObject({
        total_count: z.number().nullish(),
        page_info: MagentoCompanyPageInfoSchema.nullish(),
        items: z.array(MagentoCompanyAddressSchema.nullable()),
      }),
    })
    .nullable(),
});

export const MagentoCreateCompanyAddressResponseSchema = z.looseObject({
  createCompanyAddress: MagentoCompanyAddressSchema.nullable(),
});

export const MagentoUpdateCompanyAddressResponseSchema = z.looseObject({
  updateCompanyAddress: MagentoCompanyAddressSchema.nullable(),
});

export const MagentoDeleteCompanyAddressResponseSchema = z.looseObject({
  deleteCompanyAddress: z.boolean().nullable(),
});

export const MagentoSetDefaultCompanyAddressResponseSchema = z.looseObject({
  setDefaultCompanyAddress: MagentoCompanyAddressSchema.nullable(),
});

export const MagentoCreateCompanyResponseSchema = z.looseObject({
  createCompany: z.looseObject({ company: MagentoCompanySchema }).nullable(),
});

export const MagentoCreateCompanyUserResponseSchema = z.looseObject({
  createCompanyUser: z
    .looseObject({ user: MagentoCompanyUserSchema.nullable() })
    .nullable(),
});

export const MagentoUpdateCompanyUserResponseSchema = z.looseObject({
  updateCompanyUser: z
    .looseObject({ user: MagentoCompanyUserSchema.nullable() })
    .nullable(),
});

export const MagentoDeleteCompanyUserResponseSchema = z.looseObject({
  deleteCompanyUserV2: z.looseObject({ success: z.boolean() }).nullable(),
});

export const MagentoAcceptCompanyInvitationResponseSchema = z.looseObject({
  acceptCompanyInvitation: z
    .looseObject({ success: z.boolean().nullish() })
    .nullable(),
});

export const MagentoCountryRegionsResponseSchema = z.looseObject({
  country: z
    .looseObject({
      available_regions: z
        .array(
          z.looseObject({
            id: z.number(),
            code: z.string(),
            name: z.string(),
          }),
        )
        .nullish(),
    })
    .nullable(),
});

/**
 * Admin REST `GET /V1/company/:id` (`CompanyInterface`). Status is numeric:
 * 0 pending approval, 1 approved, 2 rejected, 3 blocked.
 */
export const MagentoAdminCompanySchema = z.looseObject({
  id: z.number(),
  status: z.number(),
  company_name: z.string().nullish(),
  legal_name: z.string().nullish(),
  company_email: z.string().nullish(),
  vat_tax_id: z.string().nullish(),
  telephone: z.string().nullish(),
  reject_reason: z.string().nullish(),
});

// --- GraphQL inputs --------------------------------------------------------

export interface MagentoCompanyRegionInput {
  region?: string;
  region_code?: string;
  region_id?: number;
}

export interface MagentoCompanyCreateInput {
  company_name: string;
  company_email: string;
  legal_name?: string;
  vat_tax_id?: string;
  company_admin: {
    email: string;
    firstname: string;
    lastname: string;
    telephone?: string;
  };
  legal_address: {
    street: string[];
    city: string;
    region: MagentoCompanyRegionInput;
    postcode: string;
    country_id: string;
    telephone: string;
  };
}

/** `CustomerAddressRegionInput`. */
export interface MagentoCustomerAddressRegionInput {
  region?: string;
  region_code?: string;
  region_id?: number;
}

/** `CompanyAddressUpdateInput` (the address type cannot change). */
export interface MagentoCompanyAddressUpdateInput {
  is_default: boolean;
  nickname?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  street?: string[];
  city?: string;
  country_code?: string;
  region?: MagentoCustomerAddressRegionInput;
  postcode?: string;
  telephone?: string;
}

/** `CompanyAddressInput`. */
export interface MagentoCompanyAddressInput extends MagentoCompanyAddressUpdateInput {
  address_type: MagentoCompanyAddressType;
}

export interface MagentoCompanyUserCreateInput {
  email: string;
  firstname: string;
  lastname: string;
  job_title: string;
  telephone: string;
  role_id: string;
  status: MagentoCompanyUserStatus;
}

export interface MagentoCompanyUserUpdateInput {
  id: string;
  role_id?: string;
  status?: MagentoCompanyUserStatus;
}

export interface MagentoCompanyInvitationInput {
  code: string;
  role_id?: string;
  user: {
    company_id: string;
    customer_id: string;
    status?: MagentoCompanyUserStatus;
  };
}

export type MagentoCompanyRegion = z.infer<typeof MagentoCompanyRegionSchema>;
export type MagentoCompanyLegalAddress = z.infer<typeof MagentoCompanyLegalAddressSchema>;
export type MagentoCompanyRole = z.infer<typeof MagentoCompanyRoleSchema>;
export type MagentoCompanyUserStatus = z.infer<typeof MagentoCompanyUserStatusSchema>;
export type MagentoCompanyUser = z.infer<typeof MagentoCompanyUserSchema>;
export type MagentoCompanyAdmin = z.infer<typeof MagentoCompanyAdminSchema>;
export type MagentoCompany = z.infer<typeof MagentoCompanySchema>;
export type MagentoCompanyStatus = z.infer<typeof MagentoCompanyStatusSchema>;
export type MagentoCompanyBasicInfo = z.infer<typeof MagentoCompanyBasicInfoSchema>;
export type MagentoCompanyPageInfo = z.infer<typeof MagentoCompanyPageInfoSchema>;
export type MagentoCompanyAddressType = z.infer<typeof MagentoCompanyAddressTypeSchema>;
export type MagentoCompanyAddress = z.infer<typeof MagentoCompanyAddressSchema>;
export type MagentoCompanyConfig = z.infer<typeof MagentoCompanyConfigSchema>;
export type MagentoCompanyUsers = z.infer<typeof MagentoCompanyUsersSchema>;
export type MagentoAdminCompany = z.infer<typeof MagentoAdminCompanySchema>;
