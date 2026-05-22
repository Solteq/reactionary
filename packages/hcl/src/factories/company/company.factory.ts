import type * as z from 'zod';
import type {
  Address,
  AnyCompanyPaginatedListSchema,
  AnyCompanySchema,
  Company,
  CompanyFactory,
  CompanyPaginatedList,
  CompanyQueryList,
  CompanySchema,
  CompanyPaginatedListSchema,
  RequestContext,
} from '@reactionary/core';
import type {
  HclOrganizationItem,
  HclOrganizationListResponse,
  HclWcsOrgContact,
} from '../../schema/hcl.schema.js';

export class HclCompanyFactory<
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

  public parseCompany(
    _context: RequestContext,
    data: HclOrganizationItem,
  ): z.output<TCompanySchema> {
    const result = {
      identifier: {
        taxIdentifier:
          data.taxPayerId ?? data.organizationId ?? data.orgEntityId ?? '',
      },
      name: data.organizationName ?? data.displayName ?? '',
      dunsIdentifier: undefined,
      tinIdentifier: data.legalId,
      logo: undefined,
      // state '0' = locked/blocked; any other value (or absent) = active
      status: data.state === '0' ? 'blocked' : 'active',
      pointOfContact: {
        email: data.contactInfo?.email1 ?? '',
        phone: data.contactInfo?.phone1,
      },
      billingAddress: data.contactInfo
        ? this.parseOrgContact(data.contactInfo, 'default')
        : this.parseOrgContact(
            {
              nickName: 'default',
              firstName: '',
              lastName: '',
              addressLine: [],
              city: '',
              stateOrProvinceName: '',
              zipCode: '',
              country: '',
            },
            'default',
          ),
      alternateShippingAddresses: (data.addressBook ?? []).map((c, i) =>
        this.parseOrgContact(c, c.nickName ?? `address-${i}`),
      ),
      isCustomAddressesAllowed: false,
      isSelfManagementOfShippingAddressesAllowed: false,
    } satisfies Company;

    return this.companySchema.parse(result);
  }

  public parseCompanyPaginatedList(
    context: RequestContext,
    data: HclOrganizationListResponse,
    _query: CompanyQueryList,
  ): z.output<TCompanyPaginatedListSchema> {
    const items = (data.organizationDataBeans ?? []).map((org) =>
      this.parseCompany(context, org),
    );

    const pageSize = Math.max(1, items.length);
    const result = {
      identifier: {
        paginationOptions: { pageNumber: 1, pageSize },
      },
      items,
      totalCount: Number(data.recordSetTotal ?? items.length),
      pageSize,
      pageNumber: 1,
      totalPages: 1,
    } satisfies CompanyPaginatedList;

    return this.companyPaginatedListSchema.parse(result);
  }

  protected parseOrgContact(
    contact: HclWcsOrgContact,
    defaultNickName: string,
  ): Address {
    return {
      identifier: { nickName: contact.nickName ?? defaultNickName },
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      streetAddress: contact.addressLine?.[0] ?? '',
      streetNumber: contact.addressLine?.[1] ?? '',
      city: contact.city ?? '',
      region: contact.stateOrProvinceName ?? '',
      postalCode: contact.zipCode ?? '',
      countryCode: contact.country ?? '',
    };
  }
}
