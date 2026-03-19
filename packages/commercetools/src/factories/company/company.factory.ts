import type { BusinessUnit, BusinessUnitPagedQueryResponse, Address as CTAddress } from '@commercetools/platform-sdk';
import type {
  CompanyPaginatedListSchema,
  CompanySchema} from '@reactionary/core';
import {
  type AnyCompanyPaginatedListSchema,
  type AnyCompanySchema,
  type Company,
  type CompanyFactory,
  type CompanyPaginatedList,
  type CompanyQueryList,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsCompanyFactory<
  TCompanySchema extends AnyCompanySchema = typeof CompanySchema,
  TCompanyPaginatedListSchema extends AnyCompanyPaginatedListSchema = typeof CompanyPaginatedListSchema,
> implements CompanyFactory<TCompanySchema, TCompanyPaginatedListSchema> {
  public readonly companySchema: TCompanySchema;
  public readonly companyPaginatedListSchema: TCompanyPaginatedListSchema;

  constructor(
    companySchema: TCompanySchema,
    companyPaginatedListSchema: TCompanyPaginatedListSchema,
  ) {
    this.companySchema = companySchema;
    this.companyPaginatedListSchema = companyPaginatedListSchema;
  }

  public parseCompanyPaginatedList(
    context: RequestContext,
    data: BusinessUnitPagedQueryResponse,
    payload: CompanyQueryList): z.output<TCompanyPaginatedListSchema> {

      const result = {
        pageNumber: payload.search.paginationOptions.pageNumber,
        pageSize: payload.search.paginationOptions.pageSize,
        totalCount: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / payload.search.paginationOptions.pageSize),
        items: data.results.map((bu) => this.parseCompany(context, bu)),
        identifier: payload.search,
      } satisfies CompanyPaginatedList;

      return this.companyPaginatedListSchema.parse(result);
  }

  public parseCompany(
    _context: RequestContext,
    data: BusinessUnit,
  ): z.output<TCompanySchema> {
    const defaultShippingAddress = data.defaultShippingAddressId
      ? data.addresses.find((addr) => addr.id === data.defaultShippingAddressId)
      : undefined;

    const defaultBillingAddress = data.defaultBillingAddressId
      ? data.addresses.find((addr) => addr.id === data.defaultBillingAddressId)
      : undefined;

    const alternateShippingAddresses = data.addresses
      .filter((addr) => addr.id !== data.defaultShippingAddressId)
      .filter((addr) => addr.id !== data.defaultBillingAddressId)
      .map((addr) => this.parseAddress(addr));

    const customFields = data.custom?.fields;

    const result = {
      identifier: {
        taxIdentifier: data.key,
      },
      name: data.name,
      dunsIdentifier: customFields?.['dunsIdentifier'] as string | undefined,
      tinIdentifier: customFields?.['tinIdentifier'] as string | undefined,
      status: this.mapBusinessUnitStatus(data.status),
      pointOfContact: {
        email: data.contactEmail ?? '',
        phone: customFields?.['pointOfContactPhone'] as string | undefined,
      },
      shippingAddress: defaultShippingAddress
        ? this.parseAddress(defaultShippingAddress)
        : undefined,
      billingAddress: defaultBillingAddress
        ? this.parseAddress(defaultBillingAddress)
        : {
            identifier: { nickName: '' },
            firstName: '',
            lastName: '',
            streetAddress: '',
            streetNumber: '',
            city: '',
            region: '',
            postalCode: '',
            countryCode: '',
          },
      alternateShippingAddresses,
      isCustomAddressesAllowed: (customFields?.['isCustomAddressesAllowed'] as boolean) ?? false,
      isSelfManagementOfShippingAddressesAllowed:
        (customFields?.['isSelfManagementOfShippingAddressesAllowed'] as boolean) ?? true,
    } satisfies Company;

    return this.companySchema.parse(result);
  }

  protected mapBusinessUnitStatus(status: string): 'active' | 'blocked' {
    switch (status) {
      case 'Active':
        return 'active';
      default:
        return 'blocked';
    }
  }

  protected parseAddress(address: CTAddress) {
    return {
      identifier: { nickName: address.key || '' },
      firstName: address.firstName || '',
      lastName: address.lastName || '',
      streetAddress: address.streetName || '',
      streetNumber: address.streetNumber || '',
      city: address.city || '',
      region: address.region || '',
      postalCode: address.postalCode || '',
      countryCode: address.country,
    };
  }
}
