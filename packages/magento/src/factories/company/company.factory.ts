import type {
  Address,
  AnyCompanyPaginatedListSchema,
  AnyCompanySchema,
  Company,
  CompanyFactory,
  CompanyIdentifier,
  CompanyPaginatedList,
  CompanyPaginatedListSchema,
  CompanyQueryList,
  CompanySchema,
  RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import {
  type MagentoCompany,
  type MagentoCompanyAddress,
  MagentoCompanyAddressSchema,
  MagentoCompanyConfigSchema,
  type MagentoCompanyLegalAddress,
  MagentoCompanySchema,
  type MagentoCompanyStatus,
  MagentoCompanyStatusSchema,
} from '../../schema/company.types.js';

/**
 * Core identifies a company by `taxIdentifier`. Magento's equivalent is the
 * company's `vat_tax_id`, which is optional there, so the Magento company uid
 * stands in when it is empty. The uid is always kept as the extra `key`
 * (`CompanyIdentifier` is a loose object), which is what the Magento provider
 * matches on first.
 */
export type MagentoCompanyIdentifier = CompanyIdentifier & { key: string };

export function toMagentoCompanyIdentifier(company: {
  id: string;
  vat_tax_id?: string | null;
}): MagentoCompanyIdentifier {
  return {
    taxIdentifier: company.vat_tax_id || company.id,
    key: company.id,
  };
}

/** True when the core identifier refers to the given Magento company. */
export function matchesMagentoCompany(
  identifier: CompanyIdentifier,
  company: { id: string; vat_tax_id?: string | null },
): boolean {
  if ('key' in identifier && typeof identifier.key === 'string' && identifier.key) {
    return identifier.key === company.id;
  }
  return (
    identifier.taxIdentifier === company.id ||
    (!!company.vat_tax_id && identifier.taxIdentifier === company.vat_tax_id)
  );
}

/**
 * Core's company status only knows `active` and `blocked`; a company that is
 * pending approval or was rejected is not usable, so it is `blocked`. With no
 * status at all (Magento before 2.4.7 has no `Customer.companies`), the
 * company is `active`: Magento only resolves the `company` field for users of
 * a company that has been approved.
 */
export function mapMagentoCompanyStatus(status?: MagentoCompanyStatus): Company['status'] {
  return status === undefined || status === 'APPROVED' ? 'active' : 'blocked';
}

/**
 * The core address nickname of a company address-book entry: its Magento
 * nickname, or its uid when it has none. The capability looks addresses up
 * by this value.
 */
export function magentoCompanyAddressNickName(address: { id: string; nickname?: string | null }): string {
  return address.nickname || address.id;
}

export const MagentoCompanyAddressBookInputSchema = z.object({
  config: MagentoCompanyConfigSchema,
  addresses: z.array(MagentoCompanyAddressSchema),
});

export const MagentoCompanyFactoryInputSchema = z.object({
  company: MagentoCompanySchema,
  status: MagentoCompanyStatusSchema.optional(),
  /**
   * The company address book (Adobe Commerce as a Cloud Service). Absent when
   * the edition has none or it could not be read.
   */
  addressBook: MagentoCompanyAddressBookInputSchema.optional(),
});

export type MagentoCompanyAddressBookInput = z.infer<typeof MagentoCompanyAddressBookInputSchema>;

export type MagentoCompanyFactoryInput = z.infer<typeof MagentoCompanyFactoryInputSchema>;

export const MagentoCompanyPaginatedListInputSchema = z.object({
  items: z.array(MagentoCompanyFactoryInputSchema),
  totalCount: z.number(),
});

export type MagentoCompanyPaginatedListInput = z.infer<
  typeof MagentoCompanyPaginatedListInputSchema
>;

export class MagentoCompanyFactory<
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

  /**
   * Magento's legal address has no recipient name, and its street is the
   * `[streetAddress, streetNumber]` pair the provider writes elsewhere.
   */
  protected parseLegalAddress(address?: MagentoCompanyLegalAddress | null): Address {
    const street = address?.street ?? [];
    return {
      identifier: { nickName: 'legal' },
      firstName: '',
      lastName: '',
      streetAddress: street[0] ?? '',
      streetNumber: street[1] ?? '',
      city: address?.city ?? '',
      region: address?.region?.region_code || address?.region?.region || '',
      postalCode: address?.postcode ?? '',
      countryCode: address?.country_code ?? '',
    };
  }

  /** A company address-book entry; its street is `[streetAddress, streetNumber]`. */
  protected parseCompanyAddress(address: MagentoCompanyAddress): Address {
    const street = address.street ?? [];
    return {
      identifier: { nickName: magentoCompanyAddressNickName(address) },
      firstName: address.firstname ?? '',
      lastName: address.lastname ?? '',
      streetAddress: street[0] ?? '',
      streetNumber: street[1] ?? '',
      city: address.city ?? '',
      region: address.region?.region_code || address.region?.region || '',
      postalCode: address.postcode ?? '',
      countryCode: address.country_code ?? '',
    };
  }

  protected toCompany(
    company: MagentoCompany,
    status?: MagentoCompanyStatus,
    addressBook?: MagentoCompanyAddressBookInput,
  ): Company {
    const addresses = addressBook?.addresses ?? [];
    const shipping = addresses.filter((a) => a.address_type === 'SHIPPING');
    const defaultShipping = shipping.find((a) => a.is_default);
    const defaultBilling = addresses.find((a) => a.address_type === 'BILLING' && a.is_default);
    const config = addressBook?.config;
    const addressBookEnabled = config?.address_book_enabled ?? false;

    return {
      identifier: toMagentoCompanyIdentifier(company),
      dunsIdentifier: undefined,
      tinIdentifier: undefined,
      name: company.name || company.legal_name || '',
      logo: undefined,
      status: mapMagentoCompanyStatus(status),
      pointOfContact: {
        email: company.email ?? '',
        phone: company.legal_address?.telephone ?? undefined,
      },
      // Without a company address book (on-premises), shipping addresses
      // live in each customer's own address book.
      shippingAddress: defaultShipping ? this.parseCompanyAddress(defaultShipping) : undefined,
      billingAddress: defaultBilling
        ? this.parseCompanyAddress(defaultBilling)
        : this.parseLegalAddress(company.legal_address),
      alternateShippingAddresses: shipping
        .filter((a) => a !== defaultShipping)
        .map((a) => this.parseCompanyAddress(a)),
      // Without an enabled address book, any shipping address can be entered
      // at checkout; with one, only if the company allows custom addresses.
      isCustomAddressesAllowed:
        !addressBookEnabled || (config?.address_book_custom_shipping_address_enabled ?? true),
      // Company users with the address-book permissions manage it themselves.
      isSelfManagementOfShippingAddressesAllowed: addressBookEnabled,
    };
  }

  public parseCompany(_context: RequestContext, data: unknown): z.output<TCompanySchema> {
    const input = MagentoCompanyFactoryInputSchema.parse(data);
    return this.companySchema.parse(this.toCompany(input.company, input.status, input.addressBook));
  }

  public parseCompanyPaginatedList(
    context: RequestContext,
    data: unknown,
    query: CompanyQueryList,
  ): z.output<TCompanyPaginatedListSchema> {
    const input = MagentoCompanyPaginatedListInputSchema.parse(data);
    const items = input.items.map((item) => this.parseCompany(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: input.totalCount,
      totalPages: Math.ceil(input.totalCount / pageSize),
      items,
    } satisfies CompanyPaginatedList;

    return this.companyPaginatedListSchema.parse(result);
  }
}
