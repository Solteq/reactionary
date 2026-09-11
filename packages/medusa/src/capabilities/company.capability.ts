import { FetchError } from '@medusajs/js-sdk';
import {
  type Address,
  type Cache,
  type Company,
  CompanyCapability,
  type CompanyFactory,
  type CompanyFactoryWithOutput,
  type CompanyMutationAddShippingAddress,
  CompanyMutationAddShippingAddressSchema,
  type CompanyMutationMakeShippingAddressDefault,
  CompanyMutationMakeShippingAddressDefaultSchema,
  type CompanyMutationRemoveShippingAddress,
  CompanyMutationRemoveShippingAddressSchema,
  type CompanyMutationUpdateShippingAddress,
  CompanyMutationUpdateShippingAddressSchema,
  type CompanyPaginatedList,
  CompanyPaginatedListSchema,
  type CompanyQueryById,
  CompanyQueryByIdSchema,
  type CompanyQueryList,
  CompanyQueryListSchema,
  CompanySchema,
  type InvalidInputError,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type {
  MedusaCompanyFactory,
  MedusaRawCompany,
  MedusaRawCompanyAddress,
} from '../factories/company/company.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:company');

export class MedusaCompanyCapability<
  TFactory extends CompanyFactory = MedusaCompanyFactory,
> extends CompanyCapability {
  protected config: MedusaConfiguration;
  protected factory: CompanyFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: CompanyFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async fetchCompany(companyId: string): Promise<MedusaRawCompany | null> {
    const client = await this.medusaApi.getClient();
    try {
      const response = await client.client.fetch<{ company: MedusaRawCompany }>(
        `/store/companies/${companyId}`,
        { method: 'GET' },
      );
      return response.company;
    } catch (err) {
      if (err instanceof FetchError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  protected async fetchCompanyOrThrow(companyId: string): Promise<MedusaRawCompany> {
    const company = await this.fetchCompany(companyId);
    if (!company) {
      throw new Error(`Company ${companyId} disappeared after mutation`);
    }
    return company;
  }

  protected async fetchCompanyByTaxIdentifier(taxIdentifier: string): Promise<MedusaRawCompany | null> {
    const client = await this.medusaApi.getClient();
    try {
      const response = await client.client.fetch<{ company: MedusaRawCompany }>(
        `/store/companies/by-tax-identifier/${taxIdentifier}`,
        { method: 'GET' },
      );
      return response.company;
    } catch (err) {
      if (err instanceof FetchError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  protected findAddress(
    company: MedusaRawCompany,
    nickName: string,
    type: 'billing' | 'shipping',
  ): MedusaRawCompanyAddress | undefined {
    return company.addresses?.find(
      (a) => a.type === type && (a.address_name ?? '') === nickName,
    );
  }

  protected addressPayload(address: Address) {
    return {
      address_name: address.identifier.nickName,
      first_name: address.firstName,
      last_name: address.lastName,
      street_address: address.streetAddress,
      street_number: address.streetNumber,
      city: address.city,
      region: address.region,
      postal_code: address.postalCode,
      country_code: address.countryCode,
    };
  }

  @Reactionary({
    inputSchema: CompanyQueryByIdSchema,
    outputSchema: CompanySchema,
  })
  public async getById(payload: CompanyQueryById): Promise<Result<Company>> {
    try {
      const company = await this.fetchCompanyByTaxIdentifier(payload.identifier.taxIdentifier);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
      }
      return success(this.factory.parseCompany(this.context, company));
    } catch (err) {
      handleProviderError('get company', err);
    }
  }

  /**
   * ponytail: there's no "list companies" route on this backend - membership is only discoverable via
   * /store/customers/me/employees, which returns company id+name but not the full Company shape, so each
   * distinct company id is re-fetched individually. Fine for the handful of companies a person typically
   * belongs to; upgrade path: ask the backend for a proper GET /store/companies scoped to the caller.
   */
  @Reactionary({
    inputSchema: CompanyQueryListSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public async listCompanies(payload: CompanyQueryList): Promise<Result<CompanyPaginatedList>> {
    debug('listCompanies', payload);
    try {
      const client = await this.medusaApi.getClient();
      const response = await client.client.fetch<{
        employees: { company: { id: string } }[];
      }>('/store/customers/me/employees', { method: 'GET' });

      const companyIds = Array.from(new Set(response.employees.map((e) => e.company.id)));
      const { pageNumber, pageSize } = payload.search.paginationOptions;
      const start = (pageNumber - 1) * pageSize;
      const pageIds = companyIds.slice(start, start + pageSize);

      const companies = (await Promise.all(pageIds.map((id) => this.fetchCompany(id)))).filter(
        (company): company is MedusaRawCompany => company !== null,
      );

      return success(
        this.factory.parseCompanyPaginatedList(
          this.context,
          { items: companies, totalCount: companyIds.length },
          payload,
        ),
      );
    } catch (err) {
      handleProviderError('list companies', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationAddShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async addShippingAddress(
    payload: CompanyMutationAddShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('addShippingAddress', payload);
    try {
      const company = await this.fetchCompanyByTaxIdentifier(payload.company.taxIdentifier);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }
      const companyId = company.id;

      const existing = this.findAddress(company, payload.address.identifier.nickName, 'shipping');
      if (existing) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'A shipping address with the same nickname already exists',
        });
      }

      const client = await this.medusaApi.getClient();
      await client.client.fetch(`/store/companies/${companyId}/addresses`, {
        method: 'POST',
        body: { ...this.addressPayload(payload.address), type: 'shipping', is_default: false },
      });

      return success(this.factory.parseCompany(this.context, await this.fetchCompanyOrThrow(companyId)));
    } catch (err) {
      handleProviderError('add shipping address', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationUpdateShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async updateShippingAddress(
    payload: CompanyMutationUpdateShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('updateShippingAddress', payload);
    try {
      const company = await this.fetchCompanyByTaxIdentifier(payload.company.taxIdentifier);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }
      const companyId = company.id;

      const existing = this.findAddress(company, payload.address.identifier.nickName, 'shipping');
      if (!existing) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.address.identifier });
      }

      const client = await this.medusaApi.getClient();
      await client.client.fetch(`/store/companies/${companyId}/addresses/${existing.id}`, {
        method: 'POST',
        body: this.addressPayload(payload.address),
      });

      return success(this.factory.parseCompany(this.context, await this.fetchCompanyOrThrow(companyId)));
    } catch (err) {
      handleProviderError('update shipping address', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationRemoveShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async removeShippingAddress(
    payload: CompanyMutationRemoveShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('removeShippingAddress', payload);
    try {
      const company = await this.fetchCompanyByTaxIdentifier(payload.company.taxIdentifier);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }
      const companyId = company.id;

      const existing = this.findAddress(company, payload.addressIdentifier.nickName, 'shipping');
      if (!existing) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.addressIdentifier });
      }

      const client = await this.medusaApi.getClient();
      await client.client.fetch(`/store/companies/${companyId}/addresses/${existing.id}`, {
        method: 'DELETE',
      });

      return success(this.factory.parseCompany(this.context, await this.fetchCompanyOrThrow(companyId)));
    } catch (err) {
      handleProviderError('remove shipping address', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationMakeShippingAddressDefaultSchema,
    outputSchema: CompanySchema,
  })
  public async makeShippingAddressDefault(
    payload: CompanyMutationMakeShippingAddressDefault,
  ): Promise<Result<Company, NotFoundError>> {
    debug('makeShippingAddressDefault', payload);
    try {
      const company = await this.fetchCompanyByTaxIdentifier(payload.company.taxIdentifier);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }
      const companyId = company.id;

      const existing = this.findAddress(company, payload.addressIdentifier.nickName, 'shipping');
      if (!existing) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.addressIdentifier });
      }

      const client = await this.medusaApi.getClient();
      await client.client.fetch(`/store/companies/${companyId}/addresses/${existing.id}`, {
        method: 'POST',
        body: { is_default: true },
      });

      return success(this.factory.parseCompany(this.context, await this.fetchCompanyOrThrow(companyId)));
    } catch (err) {
      handleProviderError('make shipping address default', err);
    }
  }
}
