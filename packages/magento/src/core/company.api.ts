import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  Fail,
  GenericError,
  InvalidInputError,
  NotFoundError,
} from '@reactionary/core';
import { error } from '@reactionary/core';
import type { MagentoClient, MagentoGraphQLRequestOptions } from './client.js';
import {
  ACCEPT_COMPANY_INVITATION_MUTATION,
  COMPANY_ADDRESSES_QUERY,
  COMPANY_QUERY,
  COMPANY_ROLES_QUERY,
  COMPANY_USERS_QUERY,
  COMPANY_USER_QUERY,
  COUNTRY_REGIONS_QUERY,
  CREATE_COMPANY_ADDRESS_MUTATION,
  CREATE_COMPANY_MUTATION,
  CREATE_COMPANY_USER_MUTATION,
  CUSTOMER_COMPANIES_QUERY,
  DELETE_COMPANY_ADDRESS_MUTATION,
  DELETE_COMPANY_USER_MUTATION,
  SET_DEFAULT_COMPANY_ADDRESS_MUTATION,
  UPDATE_COMPANY_ADDRESS_MUTATION,
  UPDATE_COMPANY_USER_MUTATION,
} from './company.graphql.js';
import { isMagentoApiError } from './errors.js';
import {
  MagentoAcceptCompanyInvitationResponseSchema,
  type MagentoAdminCompany,
  MagentoAdminCompanySchema,
  type MagentoCompany,
  type MagentoCompanyAddress,
  type MagentoCompanyAddressInput,
  MagentoCompanyAddressesResponseSchema,
  type MagentoCompanyAddressUpdateInput,
  type MagentoCompanyBasicInfo,
  type MagentoCompanyConfig,
  type MagentoCompanyCreateInput,
  MagentoCompanyResponseSchema,
  type MagentoCompanyInvitationInput,
  type MagentoCompanyRole,
  MagentoCompanyRolesResponseSchema,
  type MagentoCompanyStatus,
  type MagentoCompanyUser,
  MagentoCompanyUserResponseSchema,
  type MagentoCompanyUserCreateInput,
  type MagentoCompanyUserStatus,
  type MagentoCompanyUserUpdateInput,
  type MagentoCompanyUsers,
  MagentoCompanyUsersResponseSchema,
  MagentoCountryRegionsResponseSchema,
  MagentoCreateCompanyAddressResponseSchema,
  MagentoCreateCompanyResponseSchema,
  MagentoCreateCompanyUserResponseSchema,
  MagentoCustomerCompaniesResponseSchema,
  type MagentoCustomerAddressRegionInput,
  MagentoDeleteCompanyAddressResponseSchema,
  MagentoDeleteCompanyUserResponseSchema,
  type MagentoCompanyPageInfo,
  MagentoSetDefaultCompanyAddressResponseSchema,
  MagentoUpdateCompanyAddressResponseSchema,
  MagentoUpdateCompanyUserResponseSchema,
} from '../schema/company.types.js';

const ROLES_PAGE_SIZE = 100;
const COMPANIES_PAGE_SIZE = 50;
const ADDRESSES_PAGE_SIZE = 100;
/** Upper bound on the pages read when collecting a full list. */
const MAX_PAGES = 100;

/**
 * The request header that selects the company context of a B2B GraphQL call
 * (Adobe Commerce 2.4.7+), carrying the company uid (`Company.id`). Without
 * it, Magento acts on the customer's default company.
 */
export const MAGENTO_COMPANY_HEADER = 'X-Adobe-Company';

/** Request options that scope a GraphQL call to the given company, if any. */
export function companyContext(companyUid?: string): MagentoGraphQLRequestOptions | undefined {
  return companyUid ? { headers: { [MAGENTO_COMPANY_HEADER]: companyUid } } : undefined;
}

/**
 * True when Magento rejected the GraphQL document because one of the named
 * fields, mutations or types does not exist in its schema, i.e. the feature
 * is not part of this Adobe Commerce edition or version (e.g.
 * `Customer.companies` before 2.4.7, the company address book outside Adobe
 * Commerce as a Cloud Service).
 */
export function isMagentoGraphQLSchemaMissing(err: unknown, names: readonly string[]): boolean {
  if (!isMagentoApiError(err) || err.transport !== 'graphql') {
    return false;
  }
  return err.graphqlErrors.some((graphqlError) =>
    SCHEMA_MISSING_PATTERNS.some((pattern) => {
      const name = pattern.exec(graphqlError.message)?.[1];
      return name !== undefined && names.includes(name);
    }),
  );
}

const SCHEMA_MISSING_PATTERNS = [
  /Cannot query field "([^"]+)"/,
  /Unknown type "([^"]+)"/,
  /Unknown argument "[^"]+" on field "(?:[^".]+\.)?([^"]+)"/,
];

/** The fields `Customer.companies` adds (Adobe Commerce 2.4.7+). */
export const CUSTOMER_COMPANIES_SCHEMA_NAMES = ['companies'] as const;

/** The schema elements of the company address book (Adobe Commerce as a Cloud Service). */
export const COMPANY_ADDRESS_BOOK_SCHEMA_NAMES = [
  'addresses',
  'config',
  'CompanyAddressInput',
  'CompanyAddressUpdateInput',
  'createCompanyAddress',
  'updateCompanyAddress',
  'deleteCompanyAddress',
  'setDefaultCompanyAddress',
] as const;

/**
 * Adobe Commerce 2.4.7+ exposes B2B entity ids (companies, company users,
 * roles) as base64-encoded uids, e.g. `Mg==` for customer 2. The rest of the
 * Magento provider identifies customers by their numeric id (REST
 * `customers/me`), so ids are decoded on the way out and encoded on the way
 * back in. Ids that are not a base64-encoded number are passed through.
 */
export function decodeMagentoUid(id: string): string {
  if (/^\d+$/.test(id)) {
    return id;
  }
  const decoded = Buffer.from(id, 'base64').toString('utf8');
  if (/^\d+$/.test(decoded) && encodeMagentoUid(decoded) === id) {
    return decoded;
  }
  return id;
}

export function encodeMagentoUid(id: string): string {
  return /^\d+$/.test(id) ? Buffer.from(id, 'utf8').toString('base64') : id;
}

/** A page of `Customer.companies`. */
export interface MagentoCustomerCompaniesPage {
  items: MagentoCompanyBasicInfo[];
  pageInfo: MagentoCompanyPageInfo | null;
}

/** The company address book: its settings and every address in it. */
export interface MagentoCompanyAddressBook {
  config: MagentoCompanyConfig;
  addresses: MagentoCompanyAddress[];
}

/** True when another page follows the one just read. */
function hasNextPage(
  pageInfo: MagentoCompanyPageInfo | null | undefined,
  page: number,
  itemCount: number,
  requestedPageSize: number,
): boolean {
  if (page >= MAX_PAGES) {
    return false;
  }
  if (typeof pageInfo?.total_pages === 'number') {
    return page < pageInfo.total_pages;
  }
  return itemCount >= (pageInfo?.page_size ?? requestedPageSize) && itemCount > 0;
}

/** The current company together with the page of users that was asked for. */
export interface MagentoCompanyWithUsers {
  company: MagentoCompany;
  users: MagentoCompanyUsers;
}

/** The current company together with the single user that was asked for. */
export interface MagentoCompanyWithUser {
  company: MagentoCompany;
  user: MagentoCompanyUser | null;
}

/**
 * Typed access to the Adobe Commerce B2B company module, built on the generic
 * {@link MagentoClient} transports. Every call except `createCompany` and the
 * admin status lookup acts as the signed-in customer, and resolves the
 * customer's (default) company.
 *
 * Methods throw `MagentoApiError` for Magento failures and a zod error for a
 * malformed response; capabilities map both onto typed results.
 */
export class MagentoCompanyApi {
  constructor(protected magentoApi: MagentoClient) {}

  /**
   * The signed-in customer's company, or `null` when they are not a company
   * user. With `companyUid`, the company is read in that company's context
   * (`X-Adobe-Company`); otherwise it is the customer's default company.
   */
  public async getCurrentCompany(companyUid?: string): Promise<MagentoCompany | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      COMPANY_QUERY,
      undefined,
      companyContext(companyUid),
    );
    return MagentoCompanyResponseSchema.parse(response).company;
  }

  /**
   * One page of the companies the signed-in customer belongs to
   * (`Customer.companies`, Adobe Commerce 2.4.7+; older versions reject the
   * query, see {@link isMagentoGraphQLSchemaMissing}).
   */
  public async getCustomerCompanies(
    pageSize: number,
    currentPage: number,
  ): Promise<MagentoCustomerCompaniesPage> {
    const response = await this.magentoApi.graphqlRequest<unknown>(CUSTOMER_COMPANIES_QUERY, {
      pageSize,
      currentPage,
    });
    const companies = MagentoCustomerCompaniesResponseSchema.parse(response).customer?.companies;
    return {
      items: (companies?.items ?? []).filter(
        (item): item is MagentoCompanyBasicInfo => item !== null,
      ),
      pageInfo: companies?.page_info ?? null,
    };
  }

  /**
   * Every company the signed-in customer belongs to, read page by page.
   * `UserCompaniesOutput` has no `total_count`, so the full list is what gives
   * an exact count.
   */
  public async getAllCustomerCompanies(): Promise<MagentoCompanyBasicInfo[]> {
    const all: MagentoCompanyBasicInfo[] = [];
    for (let page = 1; ; page++) {
      const { items, pageInfo } = await this.getCustomerCompanies(COMPANIES_PAGE_SIZE, page);
      all.push(...items);
      if (!hasNextPage(pageInfo, page, items.length, COMPANIES_PAGE_SIZE)) {
        return all;
      }
    }
  }

  /**
   * The approval status of the given company, read from `Customer.companies`
   * (Adobe Commerce 2.4.7+). The on-premises `Company` type carries no status.
   */
  public async getCompanyStatus(companyId: string): Promise<MagentoCompanyStatus | undefined> {
    const items = await this.getAllCustomerCompanies();
    return items.find((item) => item.id === companyId)?.status ?? undefined;
  }

  /**
   * The company address book of the given company, read in its context.
   * `null` when the customer has no company. Magento outside Adobe Commerce as
   * a Cloud Service rejects the query (see
   * {@link COMPANY_ADDRESS_BOOK_SCHEMA_NAMES}).
   */
  public async getCompanyAddressBook(companyUid: string): Promise<MagentoCompanyAddressBook | null> {
    let config: MagentoCompanyConfig | undefined;
    const addresses: MagentoCompanyAddress[] = [];
    for (let page = 1; ; page++) {
      const response = await this.magentoApi.graphqlRequest<unknown>(
        COMPANY_ADDRESSES_QUERY,
        { pageSize: ADDRESSES_PAGE_SIZE, currentPage: page },
        companyContext(companyUid),
      );
      const company = MagentoCompanyAddressesResponseSchema.parse(response).company;
      if (!company) {
        return null;
      }
      config = config ?? company.config;
      const items = company.addresses.items.filter(
        (item): item is MagentoCompanyAddress => item !== null,
      );
      addresses.push(...items);
      if (!hasNextPage(company.addresses.page_info, page, items.length, ADDRESSES_PAGE_SIZE)) {
        return { config, addresses };
      }
    }
  }

  public async createCompanyAddress(
    companyUid: string,
    input: MagentoCompanyAddressInput,
  ): Promise<MagentoCompanyAddress | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      CREATE_COMPANY_ADDRESS_MUTATION,
      { input },
      companyContext(companyUid),
    );
    return MagentoCreateCompanyAddressResponseSchema.parse(response).createCompanyAddress;
  }

  public async updateCompanyAddress(
    companyUid: string,
    addressId: string,
    input: MagentoCompanyAddressUpdateInput,
  ): Promise<MagentoCompanyAddress | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      UPDATE_COMPANY_ADDRESS_MUTATION,
      { id: addressId, input },
      companyContext(companyUid),
    );
    return MagentoUpdateCompanyAddressResponseSchema.parse(response).updateCompanyAddress;
  }

  public async deleteCompanyAddress(companyUid: string, addressId: string): Promise<boolean> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      DELETE_COMPANY_ADDRESS_MUTATION,
      { id: addressId },
      companyContext(companyUid),
    );
    return MagentoDeleteCompanyAddressResponseSchema.parse(response).deleteCompanyAddress ?? false;
  }

  public async setDefaultCompanyAddress(
    companyUid: string,
    addressId: string,
  ): Promise<MagentoCompanyAddress | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      SET_DEFAULT_COMPANY_ADDRESS_MUTATION,
      { id: addressId },
      companyContext(companyUid),
    );
    return MagentoSetDefaultCompanyAddressResponseSchema.parse(response).setDefaultCompanyAddress;
  }

  /**
   * Resolves a free-text region (code, name or id) against the country's
   * predefined regions, which Magento requires by id where they exist. `null`
   * when the country has regions and none matches.
   */
  public async resolveRegion(
    countryCode: string,
    region: string,
  ): Promise<MagentoCustomerAddressRegionInput | null> {
    const text = region.trim();
    const regions = await this.getCountryRegions(countryCode);
    if (regions.length === 0) {
      return text ? { region: text } : {};
    }
    const needle = text.toLowerCase();
    const match = regions.find(
      (r) =>
        r.code.toLowerCase() === needle ||
        r.name.toLowerCase() === needle ||
        String(r.id) === text,
    );
    return match ? { region: match.name, region_code: match.code, region_id: match.id } : null;
  }

  public async getCompanyUsers(
    pageSize: number,
    currentPage: number,
    status: MagentoCompanyUserStatus | null = 'ACTIVE',
  ): Promise<MagentoCompanyWithUsers | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(COMPANY_USERS_QUERY, {
      pageSize,
      currentPage,
      status,
    });
    const company = MagentoCompanyUsersResponseSchema.parse(response).company;
    if (!company) {
      return null;
    }
    const { users, ...rest } = company;
    return { company: rest, users: users ?? { items: [], total_count: 0 } };
  }

  public async getCompanyUser(uid: string): Promise<MagentoCompanyWithUser | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(COMPANY_USER_QUERY, {
      id: uid,
    });
    const company = MagentoCompanyUserResponseSchema.parse(response).company;
    if (!company) {
      return null;
    }
    const { user, ...rest } = company;
    return { company: rest, user: user ?? null };
  }

  public async getCompanyRoles(): Promise<MagentoCompanyRole[] | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(COMPANY_ROLES_QUERY, {
      pageSize: ROLES_PAGE_SIZE,
      currentPage: 1,
    });
    const company = MagentoCompanyRolesResponseSchema.parse(response).company;
    if (!company) {
      return null;
    }
    return company.roles.items.filter((role): role is MagentoCompanyRole => role !== null);
  }

  public async getCountryRegions(
    countryCode: string,
  ): Promise<Array<{ id: number; code: string; name: string }>> {
    const response = await this.magentoApi.graphqlRequest<unknown>(COUNTRY_REGIONS_QUERY, {
      id: countryCode,
    });
    return MagentoCountryRegionsResponseSchema.parse(response).country?.available_regions ?? [];
  }

  public async createCompany(input: MagentoCompanyCreateInput): Promise<MagentoCompany | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(CREATE_COMPANY_MUTATION, {
      input,
    });
    return MagentoCreateCompanyResponseSchema.parse(response).createCompany?.company ?? null;
  }

  public async createCompanyUser(
    input: MagentoCompanyUserCreateInput,
  ): Promise<MagentoCompanyUser | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(CREATE_COMPANY_USER_MUTATION, {
      input,
    });
    return MagentoCreateCompanyUserResponseSchema.parse(response).createCompanyUser?.user ?? null;
  }

  public async updateCompanyUser(
    input: MagentoCompanyUserUpdateInput,
  ): Promise<MagentoCompanyUser | null> {
    const response = await this.magentoApi.graphqlRequest<unknown>(UPDATE_COMPANY_USER_MUTATION, {
      input,
    });
    return MagentoUpdateCompanyUserResponseSchema.parse(response).updateCompanyUser?.user ?? null;
  }

  public async deleteCompanyUser(uid: string): Promise<boolean> {
    const response = await this.magentoApi.graphqlRequest<unknown>(DELETE_COMPANY_USER_MUTATION, {
      id: uid,
    });
    return MagentoDeleteCompanyUserResponseSchema.parse(response).deleteCompanyUserV2?.success ?? false;
  }

  public async acceptCompanyInvitation(input: MagentoCompanyInvitationInput): Promise<boolean> {
    const response = await this.magentoApi.graphqlRequest<unknown>(
      ACCEPT_COMPANY_INVITATION_MUTATION,
      { input },
    );
    return (
      MagentoAcceptCompanyInvitationResponseSchema.parse(response).acceptCompanyInvitation?.success ??
      false
    );
  }

  /**
   * Admin REST lookup of a company by its numeric id, used only to report the
   * approval status of a registration request (a pending company's admin
   * cannot sign in, so there is no storefront way to read it). Callers must
   * have verified the request key's signature first (see
   * {@link verifyRegistrationKey}); the id is validated as numeric here.
   * A missing company surfaces as a 404 `MagentoApiError`.
   */
  public async getCompanyAsAdmin(numericId: string): Promise<MagentoAdminCompany> {
    if (!/^\d+$/.test(numericId)) {
      throw new Error(`Invalid Magento company id "${numericId}"`);
    }
    const response = await this.magentoApi.adminRequest<unknown>(
      'GET',
      `/V1/company/${numericId}`,
    );
    return MagentoAdminCompanySchema.parse(response);
  }
}

// --- Registration request keys -------------------------------------------

/**
 * Registration request keys are `{companyId}.{signature}`, where the
 * signature is an HMAC of the numeric company id keyed with the admin API key.
 * `checkRequestStatus` reads the status through the admin REST API, so the
 * signature is what proves the caller was handed the key by
 * `requestRegistration` rather than enumerating company ids.
 */
function signRegistration(secret: string, numericId: string): string {
  return createHmac('sha256', secret)
    .update(`reactionary:magento:company-registration:${numericId}`)
    .digest('base64url');
}

export function createRegistrationKey(secret: string, numericId: string): string {
  return `${numericId}.${signRegistration(secret, numericId)}`;
}

/** The numeric company id of a validly signed key, or `null`. */
export function verifyRegistrationKey(secret: string, key: string): string | null {
  const match = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(key);
  if (!match) {
    return null;
  }
  const numericId = match[1];
  const signature = match[2];
  if (numericId === undefined || signature === undefined) {
    return null;
  }
  const expected = Buffer.from(signRegistration(secret, numericId));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return numericId;
}

// --- Typed failures --------------------------------------------------------

export type MagentoCompanyFailure = GenericError | InvalidInputError | NotFoundError;

/**
 * Builds a failed result typed as `Fail<NotFoundError>`, which every B2B
 * contract method admits: core's `Fail` always allows `GenericError` and
 * `InvalidInputError`, but TypeScript compares `Fail<A>` with `Fail<B>` by
 * their type arguments, so the failure is rebuilt field by field.
 */
export function companyFailure(failure: MagentoCompanyFailure): Fail<NotFoundError> {
  const result = error<MagentoCompanyFailure>(failure);
  return { success: false, error: result.error, meta: result.meta };
}

export const NOT_A_COMPANY_USER_MESSAGE =
  'The signed-in customer is not a member of an Adobe Commerce B2B company';

/**
 * The failure for a core method this Adobe Commerce edition lacks the
 * GraphQL API for (e.g. the company address book on-premises).
 */
export function notSupportedOnEditionFailure(method: string, reason: string): Fail<NotFoundError> {
  return companyFailure({
    type: 'Generic',
    message: `${method} is not supported by the Magento provider on this Adobe Commerce edition: ${reason}`,
  });
}

/** The failure for a core method Magento has no counterpart for. */
export function notSupportedFailure(method: string, reason: string): Fail<NotFoundError> {
  return companyFailure({
    type: 'Generic',
    message: `${method} is not supported by the Magento provider: ${reason}`,
  });
}
