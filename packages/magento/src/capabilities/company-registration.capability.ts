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
  Reactionary,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import {
  companyFailure,
  createRegistrationKey,
  decodeMagentoUid,
  MagentoCompanyApi,
  verifyRegistrationKey,
} from '../core/company.api.js';
import type { MagentoCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import type { MagentoCompanyRegionInput } from '../schema/company.types.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { handleMagentoProviderError, isMagentoNotFoundError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:company-registration');

/**
 * Company self-registration through the Adobe Commerce B2B `createCompany`
 * mutation (guest or signed-in customer). Magento holds such companies as
 * "pending approval" until a merchant approves them, and their administrator
 * cannot sign in until then.
 *
 * Because a pending company cannot be read through the storefront API,
 * `checkRequestStatus` reads it with the admin REST API (`GET
 * /V1/company/:id`; the integration token needs the `Magento_Company::index`
 * resource). To keep that from being an enumeration oracle, the request key
 * handed out by `requestRegistration` is the company id signed with the admin
 * API key, and only validly signed keys are looked up.
 */
export class MagentoCompanyRegistrationCapability<
  TFactory extends CompanyRegistrationFactory = MagentoCompanyRegistrationFactory,
> extends CompanyRegistrationCapability {
  protected config: MagentoConfiguration;
  protected factory: CompanyRegistrationFactoryWithOutput<TFactory>;
  protected companyApi: MagentoCompanyApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CompanyRegistrationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.companyApi = new MagentoCompanyApi(magentoApi);
  }

  /**
   * Resolves the free-text region (code or name) against the country's
   * predefined regions, which Magento requires by id where they exist.
   * `null` when the country has regions and none matches.
   */
  protected async resolveRegion(address: Address): Promise<MagentoCompanyRegionInput | null> {
    const text = address.region.trim();
    const regions = await this.companyApi.getCountryRegions(address.countryCode);
    if (regions.length === 0) {
      return { region: text };
    }
    const needle = text.toLowerCase();
    const match = regions.find(
      (r) =>
        r.code.toLowerCase() === needle ||
        r.name.toLowerCase() === needle ||
        String(r.id) === text,
    );
    if (!match) {
      return null;
    }
    return { region: match.name, region_code: match.code, region_id: match.id };
  }

  @Reactionary({
    inputSchema: CompanyRegistrationMutationRegisterSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public async requestRegistration(
    payload: CompanyRegistrationMutationRegister,
  ): Promise<Result<CompanyRegistrationRequest>> {
    debug('requestRegistration %s', payload.name);
    const address = payload.billingAddress;
    const telephone = payload.pointOfContact.phone?.trim();
    if (!telephone) {
      return companyFailure({
        type: 'InvalidInput',
        error: 'pointOfContact.phone is required: Magento requires a telephone on the company legal address',
      });
    }
    if (!address.firstName.trim() || !address.lastName.trim()) {
      return companyFailure({
        type: 'InvalidInput',
        error: 'billingAddress.firstName and billingAddress.lastName are required: Magento creates the company administrator from them',
      });
    }

    try {
      const region = await this.resolveRegion(address);
      if (!region) {
        return companyFailure({
          type: 'InvalidInput',
          error: `Unknown region "${address.region}" for country "${address.countryCode}"`,
        });
      }

      const company = await this.companyApi.createCompany({
        company_name: payload.name,
        legal_name: payload.name,
        company_email: payload.pointOfContact.email,
        vat_tax_id: payload.taxIdentifier,
        company_admin: {
          email: payload.pointOfContact.email,
          firstname: address.firstName,
          lastname: address.lastName,
          telephone,
        },
        legal_address: {
          street: [address.streetAddress, address.streetNumber].filter((part) => part !== ''),
          city: address.city,
          region,
          postcode: address.postalCode,
          country_id: address.countryCode,
          telephone,
        },
      });
      if (!company) {
        return companyFailure({
          type: 'Generic',
          message: 'Failed to request company registration: Magento returned no company',
        });
      }

      const numericId = decodeMagentoUid(company.id);
      if (!/^\d+$/.test(numericId)) {
        return companyFailure({
          type: 'Generic',
          message: `Failed to request company registration: unexpected company id "${company.id}"`,
        });
      }

      return success(
        this.factory.parseCompanyRegistrationRequest(this.context, {
          source: 'storefront',
          requestKey: createRegistrationKey(this.config.adminApiKey, numericId),
          company,
        }),
      );
    } catch (err) {
      return handleMagentoProviderError('request company registration', err);
    }
  }

  @Reactionary({
    inputSchema: CompanyRegistrationQueryCheckRegistrationStatusSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public async checkRequestStatus(
    payload: CompanyRegistrationQueryCheckRegistrationStatus,
  ): Promise<Result<CompanyRegistrationRequest>> {
    debug('checkRequestStatus');
    const numericId = verifyRegistrationKey(
      this.config.adminApiKey,
      payload.requestIdentifier.key,
    );
    if (!numericId) {
      return companyFailure({ type: 'NotFound', identifier: payload.requestIdentifier });
    }

    try {
      const company = await this.companyApi.getCompanyAsAdmin(numericId);
      return success(
        this.factory.parseCompanyRegistrationRequest(this.context, {
          source: 'admin',
          requestKey: payload.requestIdentifier.key,
          company,
        }),
      );
    } catch (err) {
      if (isMagentoNotFoundError(err)) {
        return companyFailure({ type: 'NotFound', identifier: payload.requestIdentifier });
      }
      return handleMagentoProviderError('check company registration status', err);
    }
  }
}
