import type {
  CompanyPaginatedListSchema,
  CompanySchema} from '@reactionary/core';
import {
  type Address,
  type AnyCompanyPaginatedListSchema,
  type AnyCompanySchema,
  type Company,
  type CompanyFactory,
  type CompanyPaginatedList,
  type CompanyQueryList,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaRawCompanyAddress {
  id: string;
  type: string;
  is_default: boolean;
  address_name?: string | null;
  first_name: string;
  last_name: string;
  street_address: string;
  street_number?: string | null;
  city: string;
  region?: string | null;
  postal_code: string;
  country_code: string;
}

export interface MedusaRawCompany {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  logo_url?: string | null;
  logo_alt_text?: string | null;
  logo_width?: number | null;
  logo_height?: number | null;
  status: string;
  tax_identifier: string;
  duns_identifier?: string | null;
  tin_identifier?: string | null;
  is_custom_addresses_allowed: boolean;
  is_self_management_of_shipping_addresses_allowed: boolean;
  addresses?: MedusaRawCompanyAddress[];
}

const EMPTY_ADDRESS: Address = {
  identifier: { nickName: '' },
  firstName: '',
  lastName: '',
  streetAddress: '',
  streetNumber: '',
  city: '',
  region: '',
  postalCode: '',
  countryCode: '',
};

export class MedusaCompanyFactory<
  TCompanySchema extends AnyCompanySchema = typeof CompanySchema,
  TCompanyPaginatedListSchema extends
    AnyCompanyPaginatedListSchema = typeof CompanyPaginatedListSchema,
> implements CompanyFactory<TCompanySchema, TCompanyPaginatedListSchema>
{
  public readonly companySchema: TCompanySchema;
  public readonly companyPaginatedListSchema: TCompanyPaginatedListSchema;

  constructor(
    companySchema: TCompanySchema,
    companyPaginatedListSchema: TCompanyPaginatedListSchema,
  ) {
    this.companySchema = companySchema;
    this.companyPaginatedListSchema = companyPaginatedListSchema;
  }

  protected parseAddress(raw: MedusaRawCompanyAddress): Address {
    return {
      identifier: { nickName: raw.address_name ?? '' },
      firstName: raw.first_name,
      lastName: raw.last_name,
      streetAddress: raw.street_address,
      streetNumber: raw.street_number ?? '',
      city: raw.city,
      region: raw.region ?? '',
      postalCode: raw.postal_code,
      countryCode: raw.country_code,
    };
  }

  public parseCompany(_context: RequestContext, data: MedusaRawCompany): z.output<TCompanySchema> {
    const addresses = data.addresses ?? [];
    const billing =
      addresses.find((a) => a.type === 'billing' && a.is_default) ??
      addresses.find((a) => a.type === 'billing');
    const shippingAddresses = addresses.filter((a) => a.type === 'shipping');
    const shipping = shippingAddresses.find((a) => a.is_default);
    const alternateShippingAddresses = shippingAddresses.map((a) => this.parseAddress(a));

    const result = {
      identifier: { taxIdentifier: data.tax_identifier },
      dunsIdentifier: data.duns_identifier ?? undefined,
      tinIdentifier: data.tin_identifier ?? undefined,
      name: data.name,
      logo: data.logo_url
        ? {
            sourceUrl: data.logo_url,
            altText: data.logo_alt_text ?? '',
            width: data.logo_width ?? undefined,
            height: data.logo_height ?? undefined,
          }
        : undefined,
      // ponytail: core's CompanyStatus only has 2 values (active/blocked), but the backend has 3
      // (active/pending_approval/blocked) - pending_approval collapses into blocked here. Use
      // CompanyRegistrationRequest's status instead (see MedusaCompanyRegistrationFactory) when the
      // pending/denied distinction matters, e.g. right after requestRegistration.
      status: data.status === 'active' ? 'active' : 'blocked',
      pointOfContact: { email: data.email, phone: data.phone ?? undefined },
      // "Default shipping address if different from default billing address" (per CompanySchema) - so
      // absent an explicit shipping default, ship-to-billing is the implied default.
      shippingAddress: shipping
        ? this.parseAddress(shipping)
        : billing
          ? this.parseAddress(billing)
          : undefined,
      billingAddress: billing ? this.parseAddress(billing) : EMPTY_ADDRESS,
      alternateShippingAddresses,
      isCustomAddressesAllowed: data.is_custom_addresses_allowed,
      isSelfManagementOfShippingAddressesAllowed:
        data.is_self_management_of_shipping_addresses_allowed,
    } satisfies Company;

    return this.companySchema.parse(result);
  }

  public parseCompanyPaginatedList(
    context: RequestContext,
    data: { items: MedusaRawCompany[]; totalCount: number },
    query: CompanyQueryList,
  ): z.output<TCompanyPaginatedListSchema> {
    const items = data.items.map((item) => this.parseCompany(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: data.totalCount,
      totalPages: Math.ceil(data.totalCount / pageSize),
      items,
    } satisfies CompanyPaginatedList;

    return this.companyPaginatedListSchema.parse(result);
  }
}
