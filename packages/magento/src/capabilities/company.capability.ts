import {
  type Address,
  type Cache,
  type Company,
  CompanyCapability,
  type CompanyFactory,
  type CompanyFactoryWithOutput,
  type CompanyIdentifier,
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
  type Fail,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import {
  COMPANY_ADDRESS_BOOK_SCHEMA_NAMES,
  CUSTOMER_COMPANIES_SCHEMA_NAMES,
  companyFailure,
  isMagentoGraphQLSchemaMissing,
  type MagentoCompanyAddressBook,
  MagentoCompanyApi,
  NOT_A_COMPANY_USER_MESSAGE,
  notSupportedOnEditionFailure,
} from '../core/company.api.js';
import { isMagentoApiError } from '../core/errors.js';
import {
  type MagentoCompanyFactory,
  type MagentoCompanyFactoryInput,
  magentoCompanyAddressNickName,
  matchesMagentoCompany,
} from '../factories/company/company.factory.js';
import type {
  MagentoCompany,
  MagentoCompanyAddress,
  MagentoCompanyAddressUpdateInput,
  MagentoCompanyBasicInfo,
  MagentoCompanyStatus,
} from '../schema/company.types.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:company');

const ADDRESS_BOOK_NOT_AVAILABLE =
  'the company address book is part of the B2B Storefront Compatibility Package of Adobe Commerce as a Cloud Service';

/** A company the customer belongs to, resolved from a core identifier. */
type CompanyResolution =
  | {
      kind: 'found';
      company: MagentoCompany;
      status?: MagentoCompanyStatus;
      /**
       * Whether Magento knows `Customer.companies` (2.4.7+). Without it the
       * company was read without `X-Adobe-Company` and the edition has no
       * company address book either.
       */
      multiCompany: boolean;
    }
  | { kind: 'none' }
  | { kind: 'not-found' }
  /** A company of the customer that Magento will not resolve (see `fetchCompanyDetails`). */
  | { kind: 'unreadable'; basic: MagentoCompanyBasicInfo };

/** The company and address book a shipping-address mutation acts on. */
interface AddressBookTarget {
  company: MagentoCompany;
  status?: MagentoCompanyStatus;
  addressBook: MagentoCompanyAddressBook;
}

function unreadableMessage(basic: MagentoCompanyBasicInfo): string {
  return `Magento does not resolve company ${basic.id} (status ${basic.status ?? 'unknown'}) for the signed-in customer`;
}

function hasKey(identifier: CompanyIdentifier): boolean {
  return 'key' in identifier && typeof identifier.key === 'string' && identifier.key !== '';
}

/**
 * Adobe Commerce B2B companies, read through the storefront GraphQL `company`
 * field as the signed-in company user.
 *
 * - Adobe Commerce 2.4.7+ lets a customer belong to several companies
 *   (`Customer.companies`); each is read in its own context by sending its
 *   uid in the `X-Adobe-Company` header. Older versions have only the
 *   customer's current company.
 * - Any company the customer does not belong to is `NotFound`; a customer
 *   outside any company gets a `Generic` error. A company Magento will not
 *   resolve in its context (e.g. pending approval) is a `Generic` error on
 *   read and is left out of `listCompanies`.
 * - Company shipping addresses use the company address book of Adobe
 *   Commerce as a Cloud Service (`Company.addresses`,
 *   `createCompanyAddress`, ...). Elsewhere the mutations return a `Generic`
 *   "not supported on this Adobe Commerce edition" error and reads leave the
 *   shipping addresses empty.
 */
export class MagentoCompanyCapability<
  TFactory extends CompanyFactory = MagentoCompanyFactory,
> extends CompanyCapability {
  protected config: MagentoConfiguration;
  protected factory: CompanyFactoryWithOutput<TFactory>;
  protected companyApi: MagentoCompanyApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CompanyFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.companyApi = new MagentoCompanyApi(magentoApi);
  }

  /**
   * The companies the customer belongs to, or `null` when this Magento has no
   * `Customer.companies` (before 2.4.7).
   */
  protected async fetchCustomerCompanies(): Promise<MagentoCompanyBasicInfo[] | null> {
    try {
      return await this.companyApi.getAllCustomerCompanies();
    } catch (err) {
      if (isMagentoGraphQLSchemaMissing(err, CUSTOMER_COMPANIES_SCHEMA_NAMES)) {
        debug('Customer.companies is unavailable, using the current company only');
        return null;
      }
      throw err;
    }
  }

  /**
   * The full company, read in its own context (`X-Adobe-Company`), or `null`
   * when Magento refuses to resolve it there: typically a company that is not
   * approved yet or blocked (or an Adobe Commerce 2.4.7/2.4.8 without patch
   * ACP2E-4565, which rejects `X-Adobe-Company` together with `Store`).
   */
  protected async fetchCompanyDetails(basic: MagentoCompanyBasicInfo): Promise<MagentoCompany | null> {
    try {
      const company = await this.companyApi.getCurrentCompany(basic.id);
      if (company && company.id === basic.id) {
        return company;
      }
      debug('company %s did not resolve in its own context', basic.id);
      return null;
    } catch (err) {
      if (
        isMagentoApiError(err) &&
        (err.hasCategory('graphql-authorization') || err.hasCategory('graphql-no-such-entity'))
      ) {
        debug('company %s cannot be read in its context: %s', basic.id, err.message);
        return null;
      }
      throw err;
    }
  }

  /**
   * The company address book for reading a company. Left out (no shipping
   * addresses) when the edition has none or the user may not view it.
   */
  protected async fetchAddressBook(companyUid: string): Promise<MagentoCompanyAddressBook | undefined> {
    try {
      return (await this.companyApi.getCompanyAddressBook(companyUid)) ?? undefined;
    } catch (err) {
      if (isMagentoGraphQLSchemaMissing(err, COMPANY_ADDRESS_BOOK_SCHEMA_NAMES)) {
        debug('the company address book is unavailable on this edition');
        return undefined;
      }
      if (isMagentoApiError(err) && err.hasCategory('graphql-authorization')) {
        debug('the company address book of %s is not visible: %s', companyUid, err.message);
        return undefined;
      }
      throw err;
    }
  }

  /** Resolves a core identifier to one of the customer's companies. */
  protected async resolveCompany(identifier: CompanyIdentifier): Promise<CompanyResolution> {
    const companies = await this.fetchCustomerCompanies();
    if (companies === null || companies.length === 0) {
      const company = await this.companyApi.getCurrentCompany();
      if (!company) {
        return { kind: 'none' };
      }
      return matchesMagentoCompany(identifier, company)
        ? { kind: 'found', company, multiCompany: companies !== null }
        : { kind: 'not-found' };
    }

    const byId = companies.find((basic) => matchesMagentoCompany(identifier, { id: basic.id }));
    if (byId) {
      const company = await this.fetchCompanyDetails(byId);
      return company
        ? { kind: 'found', company, status: byId.status ?? undefined, multiCompany: true }
        : { kind: 'unreadable', basic: byId };
    }
    if (hasKey(identifier)) {
      return { kind: 'not-found' };
    }
    // Matched on the VAT id, which only the full company carries.
    for (const basic of companies) {
      const company = await this.fetchCompanyDetails(basic);
      if (company && matchesMagentoCompany(identifier, company)) {
        return { kind: 'found', company, status: basic.status ?? undefined, multiCompany: true };
      }
    }
    return { kind: 'not-found' };
  }

  protected async toFactoryInput(
    company: MagentoCompany,
    status: MagentoCompanyStatus | undefined,
    multiCompany: boolean,
  ): Promise<MagentoCompanyFactoryInput> {
    // Before 2.4.7 there is no company address book to read.
    const addressBook = multiCompany ? await this.fetchAddressBook(company.id) : undefined;
    return { company, status, addressBook };
  }

  @Reactionary({
    inputSchema: CompanyQueryByIdSchema,
    outputSchema: CompanySchema,
  })
  public async getById(payload: CompanyQueryById): Promise<Result<Company>> {
    debug('getById %o', payload.identifier);
    try {
      const resolution = await this.resolveCompany(payload.identifier);
      if (resolution.kind === 'none') {
        return companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
      }
      if (resolution.kind === 'not-found') {
        return companyFailure({ type: 'NotFound', identifier: payload.identifier });
      }
      if (resolution.kind === 'unreadable') {
        return companyFailure({ type: 'Generic', message: unreadableMessage(resolution.basic) });
      }
      const input = await this.toFactoryInput(
        resolution.company,
        resolution.status,
        resolution.multiCompany,
      );
      return success(this.factory.parseCompany(this.context, input));
    } catch (err) {
      return handleMagentoProviderError('get company', err, payload.identifier);
    }
  }

  @Reactionary({
    inputSchema: CompanyQueryListSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public async listCompanies(payload: CompanyQueryList): Promise<Result<CompanyPaginatedList>> {
    debug('listCompanies %o', payload.search.paginationOptions);
    try {
      const { pageNumber, pageSize } = payload.search.paginationOptions;
      const start = (pageNumber - 1) * pageSize;
      const companies = await this.fetchCustomerCompanies();

      if (companies === null || companies.length === 0) {
        // Only the current company is known (or none, outside any company).
        const company = await this.companyApi.getCurrentCompany();
        const all = company ? [await this.toFactoryInput(company, undefined, companies !== null)] : [];
        return success(
          this.factory.parseCompanyPaginatedList(
            this.context,
            { items: all.slice(start, start + pageSize), totalCount: all.length },
            payload,
          ),
        );
      }

      // Companies Magento will not resolve (e.g. pending approval) cannot be
      // interacted with, so they are left out; reading them all first keeps
      // the total exact.
      const readable: Array<{ company: MagentoCompany; status?: MagentoCompanyStatus }> = [];
      for (const basic of companies) {
        const company = await this.fetchCompanyDetails(basic);
        if (company) {
          readable.push({ company, status: basic.status ?? undefined });
        }
      }
      const items = await Promise.all(
        readable
          .slice(start, start + pageSize)
          .map(({ company, status }) => this.toFactoryInput(company, status, true)),
      );
      return success(
        this.factory.parseCompanyPaginatedList(
          this.context,
          { items, totalCount: readable.length },
          payload,
        ),
      );
    } catch (err) {
      return handleMagentoProviderError('list companies', err);
    }
  }

  // --- Company address book -------------------------------------------------

  /**
   * Resolves the company and reads its address book for a shipping-address
   * mutation, or returns the failure to report.
   */
  protected async resolveAddressBookTarget(
    method: string,
    identifier: CompanyIdentifier,
  ): Promise<AddressBookTarget | Fail<NotFoundError>> {
    const resolution = await this.resolveCompany(identifier);
    if (resolution.kind === 'none') {
      return companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
    }
    if (resolution.kind === 'not-found') {
      return companyFailure({ type: 'NotFound', identifier });
    }
    if (resolution.kind === 'unreadable') {
      return companyFailure({ type: 'Generic', message: unreadableMessage(resolution.basic) });
    }
    if (!resolution.multiCompany) {
      return notSupportedOnEditionFailure(method, ADDRESS_BOOK_NOT_AVAILABLE);
    }
    const addressBook = await this.companyApi.getCompanyAddressBook(resolution.company.id);
    if (!addressBook) {
      return companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
    }
    if (!addressBook.config.address_book_enabled) {
      return companyFailure({
        type: 'Generic',
        message: `${method} failed: the company address book is not enabled for this company`,
      });
    }
    return { company: resolution.company, status: resolution.status, addressBook };
  }

  protected findShippingAddress(
    addressBook: MagentoCompanyAddressBook,
    nickName: string,
  ): MagentoCompanyAddress | undefined {
    return addressBook.addresses.find(
      (a) => a.address_type === 'SHIPPING' && magentoCompanyAddressNickName(a) === nickName,
    );
  }

  /**
   * The Magento address fields for a core address, or `null` when its region
   * is not one of the country's predefined regions. Magento keeps the
   * `[streetAddress, streetNumber]` pair as two street lines.
   */
  protected async toAddressInput(
    address: Address,
    company: MagentoCompany,
    existing?: MagentoCompanyAddress,
  ): Promise<Omit<MagentoCompanyAddressUpdateInput, 'is_default'> | null> {
    const region = await this.companyApi.resolveRegion(address.countryCode, address.region);
    if (!region) {
      return null;
    }
    const telephone = existing?.telephone || company.legal_address?.telephone;
    return {
      nickname: address.identifier.nickName || undefined,
      firstname: address.firstName,
      lastname: address.lastName,
      company: existing?.company ?? company.name ?? undefined,
      street: address.streetNumber
        ? [address.streetAddress, address.streetNumber]
        : [address.streetAddress],
      city: address.city,
      country_code: address.countryCode,
      region,
      postcode: address.postalCode,
      telephone: telephone || undefined,
    };
  }

  protected async readUpdatedCompany(target: AddressBookTarget): Promise<Company> {
    const addressBook = await this.companyApi.getCompanyAddressBook(target.company.id);
    return this.factory.parseCompany(this.context, {
      company: target.company,
      status: target.status,
      addressBook: addressBook ?? undefined,
    });
  }

  /** Maps a mutation failure, reporting a missing address book as unsupported. */
  protected addressBookFailure(
    method: string,
    action: string,
    err: unknown,
    identifier: unknown,
  ): Fail<NotFoundError> {
    if (isMagentoGraphQLSchemaMissing(err, COMPANY_ADDRESS_BOOK_SCHEMA_NAMES)) {
      return notSupportedOnEditionFailure(method, ADDRESS_BOOK_NOT_AVAILABLE);
    }
    return handleMagentoProviderError(action, err, identifier);
  }

  @Reactionary({
    inputSchema: CompanyMutationAddShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async addShippingAddress(
    payload: CompanyMutationAddShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('addShippingAddress %o', payload.company);
    try {
      const target = await this.resolveAddressBookTarget('addShippingAddress', payload.company);
      if ('success' in target) {
        return target;
      }
      if (this.findShippingAddress(target.addressBook, payload.address.identifier.nickName)) {
        return companyFailure({
          type: 'InvalidInput',
          error: 'A shipping address with the same nickname already exists',
        });
      }
      const input = await this.toAddressInput(payload.address, target.company);
      if (!input) {
        return companyFailure({
          type: 'InvalidInput',
          error: `Unknown region "${payload.address.region}" for country "${payload.address.countryCode}"`,
        });
      }
      await this.companyApi.createCompanyAddress(target.company.id, {
        ...input,
        address_type: 'SHIPPING',
        // Core: adding an address never makes it the default.
        is_default: false,
      });
      return success(await this.readUpdatedCompany(target));
    } catch (err) {
      return this.addressBookFailure('addShippingAddress', 'add company shipping address', err, payload.company);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationUpdateShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async updateShippingAddress(
    payload: CompanyMutationUpdateShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('updateShippingAddress %o', payload.company);
    try {
      const target = await this.resolveAddressBookTarget('updateShippingAddress', payload.company);
      if ('success' in target) {
        return target;
      }
      const existing = this.findShippingAddress(target.addressBook, payload.address.identifier.nickName);
      if (!existing) {
        return companyFailure({ type: 'NotFound', identifier: payload.address.identifier });
      }
      const input = await this.toAddressInput(payload.address, target.company, existing);
      if (!input) {
        return companyFailure({
          type: 'InvalidInput',
          error: `Unknown region "${payload.address.region}" for country "${payload.address.countryCode}"`,
        });
      }
      await this.companyApi.updateCompanyAddress(target.company.id, existing.id, {
        ...input,
        // An address addressed by its uid keeps having no nickname.
        nickname: existing.nickname ?? undefined,
        is_default: existing.is_default,
      });
      return success(await this.readUpdatedCompany(target));
    } catch (err) {
      return this.addressBookFailure('updateShippingAddress', 'update company shipping address', err, payload.company);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationRemoveShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public async removeShippingAddress(
    payload: CompanyMutationRemoveShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    debug('removeShippingAddress %o', payload.company);
    try {
      const target = await this.resolveAddressBookTarget('removeShippingAddress', payload.company);
      if ('success' in target) {
        return target;
      }
      const existing = this.findShippingAddress(target.addressBook, payload.addressIdentifier.nickName);
      if (!existing) {
        return companyFailure({ type: 'NotFound', identifier: payload.addressIdentifier });
      }
      const deleted = await this.companyApi.deleteCompanyAddress(target.company.id, existing.id);
      if (!deleted) {
        return companyFailure({
          type: 'Generic',
          message: `Magento did not remove the company shipping address "${payload.addressIdentifier.nickName}"`,
        });
      }
      // Core: removing the default promotes another shipping address.
      if (existing.is_default) {
        const next = target.addressBook.addresses.find(
          (a) => a.address_type === 'SHIPPING' && a.id !== existing.id,
        );
        if (next) {
          await this.companyApi.setDefaultCompanyAddress(target.company.id, next.id);
        }
      }
      return success(await this.readUpdatedCompany(target));
    } catch (err) {
      return this.addressBookFailure('removeShippingAddress', 'remove company shipping address', err, payload.company);
    }
  }

  @Reactionary({
    inputSchema: CompanyMutationMakeShippingAddressDefaultSchema,
    outputSchema: CompanySchema,
  })
  public async makeShippingAddressDefault(
    payload: CompanyMutationMakeShippingAddressDefault,
  ): Promise<Result<Company, NotFoundError>> {
    debug('makeShippingAddressDefault %o', payload.company);
    try {
      const target = await this.resolveAddressBookTarget('makeShippingAddressDefault', payload.company);
      if ('success' in target) {
        return target;
      }
      const existing = this.findShippingAddress(target.addressBook, payload.addressIdentifier.nickName);
      if (!existing) {
        return companyFailure({ type: 'NotFound', identifier: payload.addressIdentifier });
      }
      if (!existing.is_default) {
        await this.companyApi.setDefaultCompanyAddress(target.company.id, existing.id);
      }
      return success(await this.readUpdatedCompany(target));
    } catch (err) {
      return this.addressBookFailure(
        'makeShippingAddressDefault',
        'make company shipping address default',
        err,
        payload.company,
      );
    }
  }
}
