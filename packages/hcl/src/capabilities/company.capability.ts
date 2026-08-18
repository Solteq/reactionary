import {
  type Address,
  type Cache,
  type Company,
  CompanyCapability,
  type CompanyFactory,
  type CompanyFactoryOutput,
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
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclCompanyFactory } from '../factories/company/company.factory.js';
import type {
  HclOrganizationItem,
  HclOrganizationListResponse,
  HclWcsOrgContact,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:company');

export class HclCompanyCapability<
  TFactory extends CompanyFactory = HclCompanyFactory,
> extends CompanyCapability {
  protected readonly config: HclConfiguration;
  protected readonly client: HclClient;
  protected readonly factory: CompanyFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: CompanyFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  @Reactionary({
    inputSchema: CompanyQueryByIdSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async getById(
    payload: CompanyQueryById,
  ): Promise<Result<CompanyFactoryOutput<TFactory>>> {
    debug('getById %s', payload.identifier.taxIdentifier);

    const raw = await this.client.callGet<HclOrganizationItem>(
      this.getOrganizationUrl(payload.identifier.taxIdentifier),
      this.getOrganizationDetailsParams(),
      { allowUndefined: true },
    );

    if (!raw) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    return success(
      this.factory.parseCompany(
        this.context,
        raw,
      ) as CompanyFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CompanyQueryListSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async listCompanies(
    payload: CompanyQueryList,
  ): Promise<Result<CompanyPaginatedList>> {
    debug(
      'listCompanies page=%d size=%d',
      payload.search.paginationOptions.pageNumber,
      payload.search.paginationOptions.pageSize,
    );

    const response = await this.client.callGet<HclOrganizationListResponse>(
      this.getOrganizationListUrl(),
      this.getOrganizationListParams(payload),
    );

    return success(
      this.factory.parseCompanyPaginatedList(this.context, response, payload),
    );
  }

  // ---------------------------------------------------------------------------
  // Mutations — address management
  // All address mutations follow the same fetch-then-mutate pattern:
  // 1. GET current org to read full addressBook
  // 2. Modify addressBook
  // 3. PUT updated data back
  // ---------------------------------------------------------------------------

  @Reactionary({
    inputSchema: CompanyMutationAddShippingAddressSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async addShippingAddress(
    payload: CompanyMutationAddShippingAddress,
  ): Promise<Result<CompanyFactoryOutput<TFactory>, NotFoundError>> {
    debug(
      'addShippingAddress %s → %s',
      payload.company.taxIdentifier,
      payload.address.identifier.nickName,
    );

    const org = await this.fetchOrganization(payload.company.taxIdentifier);
    if (!org) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const addressBook = [
      ...(org.addressBook ?? []),
      this.toOrgContact(payload.address),
    ];
    await this.client.callPut<unknown>(
      this.getUpdateOrganizationUrl(payload.company.taxIdentifier),
      this.getUpdateOrganizationBody(org, addressBook),
    );

    return success(
      this.factory.parseCompany(
        this.context,
        await this.fetchOrganizationOrThrow(payload.company.taxIdentifier),
      ) as CompanyFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CompanyMutationUpdateShippingAddressSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async updateShippingAddress(
    payload: CompanyMutationUpdateShippingAddress,
  ): Promise<Result<CompanyFactoryOutput<TFactory>, NotFoundError>> {
    debug(
      'updateShippingAddress %s → %s',
      payload.company.taxIdentifier,
      payload.address.identifier.nickName,
    );

    const org = await this.fetchOrganization(payload.company.taxIdentifier);
    if (!org) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const existing = (org.addressBook ?? []).find(
      (a) => a.nickName === payload.address.identifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.address.identifier,
      });
    }

    const addressBook = (org.addressBook ?? []).map((a) =>
      a.nickName === payload.address.identifier.nickName
        ? { ...this.toOrgContact(payload.address), primary: existing.primary }
        : a,
    );

    await this.client.callPut<unknown>(
      this.getUpdateOrganizationUrl(payload.company.taxIdentifier),
      this.getUpdateOrganizationBody(org, addressBook),
    );

    return success(
      this.factory.parseCompany(
        this.context,
        await this.fetchOrganizationOrThrow(payload.company.taxIdentifier),
      ) as CompanyFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CompanyMutationRemoveShippingAddressSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async removeShippingAddress(
    payload: CompanyMutationRemoveShippingAddress,
  ): Promise<Result<CompanyFactoryOutput<TFactory>, NotFoundError>> {
    debug(
      'removeShippingAddress %s → %s',
      payload.company.taxIdentifier,
      payload.addressIdentifier.nickName,
    );

    const org = await this.fetchOrganization(payload.company.taxIdentifier);
    if (!org) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const existing = (org.addressBook ?? []).find(
      (a) => a.nickName === payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const addressBook = (org.addressBook ?? []).filter(
      (a) => a.nickName !== payload.addressIdentifier.nickName,
    );

    await this.client.callPut<unknown>(
      this.getUpdateOrganizationUrl(payload.company.taxIdentifier),
      this.getUpdateOrganizationBody(org, addressBook),
    );

    return success(
      this.factory.parseCompany(
        this.context,
        await this.fetchOrganizationOrThrow(payload.company.taxIdentifier),
      ) as CompanyFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CompanyMutationMakeShippingAddressDefaultSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async makeShippingAddressDefault(
    payload: CompanyMutationMakeShippingAddressDefault,
  ): Promise<Result<CompanyFactoryOutput<TFactory>, NotFoundError>> {
    debug(
      'makeShippingAddressDefault %s → %s',
      payload.company.taxIdentifier,
      payload.addressIdentifier.nickName,
    );

    const org = await this.fetchOrganization(payload.company.taxIdentifier);
    if (!org) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const existing = (org.addressBook ?? []).find(
      (a) => a.nickName === payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    // Mark the target as primary='1', clear it from all others.
    const addressBook = (org.addressBook ?? []).map((a) => ({
      ...a,
      primary:
        a.nickName === payload.addressIdentifier.nickName ? '1' : undefined,
    }));

    await this.client.callPut<unknown>(
      this.getUpdateOrganizationUrl(payload.company.taxIdentifier),
      this.getUpdateOrganizationBody(org, addressBook),
    );

    return success(
      this.factory.parseCompany(
        this.context,
        await this.fetchOrganizationOrThrow(payload.company.taxIdentifier),
      ) as CompanyFactoryOutput<TFactory>,
    );
  }

  // ---------------------------------------------------------------------------
  // Extension points
  // ---------------------------------------------------------------------------

  protected getOrganizationUrl(orgId: string): string {
    return `${this.client.transactionBaseUrl}/organization/${encodeURIComponent(orgId)}`;
  }

  protected getOrganizationDetailsParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('profileName', 'IBM_Organization_Details');
    return params;
  }

  protected getOrganizationListUrl(): string {
    return `${this.client.transactionBaseUrl}/organization`;
  }

  protected getOrganizationListParams(
    query: CompanyQueryList,
  ): URLSearchParams {
    const { pageSize, pageNumber } = query.search.paginationOptions;
    const params = new URLSearchParams();
    params.set('q', 'organizationsICanAdmin');
    params.set('profileName', 'IBM_Organization_List_Summary');
    params.set('maxResults', String(pageSize));
    params.set('startIndex', String((pageNumber - 1) * pageSize));
    return params;
  }

  protected getUpdateOrganizationUrl(orgId: string): string {
    return `${this.client.transactionBaseUrl}/organization/${encodeURIComponent(orgId)}`;
  }

  protected getUpdateOrganizationBody(
    org: HclOrganizationItem,
    addressBook: HclWcsOrgContact[],
  ): Record<string, unknown> {
    return { addressBook };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  protected async fetchOrganization(
    orgId: string,
  ): Promise<HclOrganizationItem | undefined> {
    return this.client.callGet<HclOrganizationItem>(
      this.getOrganizationUrl(orgId),
      this.getOrganizationDetailsParams(),
      { allowUndefined: true },
    );
  }

  protected async fetchOrganizationOrThrow(
    orgId: string,
  ): Promise<HclOrganizationItem> {
    const org = await this.fetchOrganization(orgId);
    if (!org) throw new Error(`Organization not found: ${orgId}`);
    return org;
  }

  protected toOrgContact(address: Address): HclWcsOrgContact {
    const lines = [address.streetAddress, address.streetNumber].filter(
      Boolean,
    ) as string[];
    return {
      nickName: address.identifier.nickName,
      firstName: address.firstName,
      lastName: address.lastName,
      addressLine: lines.length ? lines : undefined,
      city: address.city,
      stateOrProvinceName: address.region,
      zipCode: address.postalCode,
      country: address.countryCode,
    };
  }
}
