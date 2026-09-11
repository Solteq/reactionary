import { FetchError } from '@medusajs/js-sdk';
import {
  type Address,
  type Cache,
  CompanyRegistrationCapability,
  type CompanyRegistrationFactory,
  type CompanyRegistrationFactoryWithOutput,
  type CompanyRegistrationMutationRegister,
  CompanyRegistrationMutationRegisterSchema,
  type CompanyRegistrationQueryCheckRegistrationStatus,
  CompanyRegistrationQueryCheckRegistrationStatusSchema,
  type CompanyRegistrationRequest,
  CompanyRegistrationRequestSchema,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import type { MedusaRawCompany } from '../factories/company/company.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:company-registration');

export class MedusaCompanyRegistrationCapability<
  TFactory extends CompanyRegistrationFactory = MedusaCompanyRegistrationFactory,
> extends CompanyRegistrationCapability {
  protected config: MedusaConfiguration;
  protected factory: CompanyRegistrationFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: CompanyRegistrationFactoryWithOutput<TFactory>,
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

  // ponytail: StoreCreateCompany doesn't accept dunsIdentifier/tinIdentifier from the registration
  // payload - the backend won't let a self-registering company set those unverified. They're silently
  // dropped. taxIdentifier IS accepted (and required) - it's the company's real, caller-chosen business
  // identifier, distinct from the Medusa-internal company id used for the rest of the REST API.
  @Reactionary({
    inputSchema: CompanyRegistrationMutationRegisterSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public async requestRegistration(
    payload: CompanyRegistrationMutationRegister,
  ): Promise<Result<CompanyRegistrationRequest>> {
    debug('requestRegistration', payload);
    try {
      const client = await this.medusaApi.getClient();
      const customerResponse = await client.store.customer.retrieve();
      if (!customerResponse.customer) {
        throw new Error('Not authenticated');
      }
      const customerId = customerResponse.customer.id;

      const createResponse = await client.client.fetch<{ companies: MedusaRawCompany[] }>(
        '/store/companies',
        {
          method: 'POST',
          body: {
            name: payload.name,
            email: payload.pointOfContact.email,
            phone: payload.pointOfContact.phone,
            tax_identifier: payload.taxIdentifier,
            currency_code: this.context.languageContext.currencyCode.toLowerCase(),
          },
        },
      );
      const companyId = createResponse.companies[0].id;

      // ponytail: this backend never auto-enrolls the registering customer as an employee of the
      // company they just created, so without this they'd be locked out of every subsequent
      // company_admin-gated action (assignRole, inviteEmployee, ...). This works because ensureRole
      // bypasses the role check while the company still has zero employees. It must happen BEFORE the
      // address call below - validateCompanyAddressAccessStep requires the caller to already be an
      // employee of the company (no "zero employees yet" bypass like ensureRole has).
      await client.client.fetch(`/store/companies/${companyId}/employees`, {
        method: 'POST',
        body: { customer_id: customerId, role: 'admin' },
      });

      await client.client.fetch(`/store/companies/${companyId}/addresses`, {
        method: 'POST',
        body: { ...this.addressPayload(payload.billingAddress), type: 'billing', is_default: true },
      });

      const company = await this.fetchCompany(companyId);
      if (!company) {
        throw new Error(`Company ${companyId} disappeared right after being created`);
      }

      return success(this.factory.parseCompanyRegistrationRequest(this.context, company));
    } catch (err) {
      handleProviderError('request company registration', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyRegistrationQueryCheckRegistrationStatusSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public async checkRequestStatus(
    payload: CompanyRegistrationQueryCheckRegistrationStatus,
  ): Promise<Result<CompanyRegistrationRequest>> {
    debug('checkRequestStatus', payload);
    try {
      const company = await this.fetchCompany(payload.requestIdentifier.key);
      if (!company) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.requestIdentifier });
      }
      return success(this.factory.parseCompanyRegistrationRequest(this.context, company));
    } catch (err) {
      handleProviderError('check company registration status', err);
    }
  }
}
