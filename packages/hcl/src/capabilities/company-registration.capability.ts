import {
  type Cache,
  type CompanyRegistrationFactory,
  type CompanyRegistrationFactoryOutput,
  type CompanyRegistrationFactoryWithOutput,
  type CompanyRegistrationMutationRegister,
  CompanyRegistrationMutationRegisterSchema,
  type CompanyRegistrationQueryCheckRegistrationStatus,
  CompanyRegistrationQueryCheckRegistrationStatusSchema,
  type CompanyRegistrationRequest,
  CompanyRegistrationRequestSchema,
  CompanyRegistrationCapability,
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
import type { HclCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import type {
  HclBuyerRegistrationResponse,
  HclOrganizationItem,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:company-registration');

export class HclCompanyRegistrationCapability<
  TFactory extends CompanyRegistrationFactory = HclCompanyRegistrationFactory,
> extends CompanyRegistrationCapability {
  protected readonly config: HclConfiguration;
  protected readonly client: HclClient;
  protected readonly factory: CompanyRegistrationFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: CompanyRegistrationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CompanyRegistrationMutationRegisterSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public override async requestRegistration(
    payload: CompanyRegistrationMutationRegister,
  ): Promise<Result<CompanyRegistrationFactoryOutput<TFactory>>> {
    debug('requestRegistration %s', payload.taxIdentifier);

    const response = await this.client.callPost<HclBuyerRegistrationResponse>(
      this.getRegisterBuyerUrl(),
      this.getRegisterBuyerBody(payload),
    );

    // After registration, GET the org to build the full domain model.
    const org = await this.client.callGet<HclOrganizationItem>(
      this.getOrganizationStatusUrl(response.orgEntityId),
      this.getOrganizationStatusParams(),
      { allowUndefined: true },
    );

    const data = org ?? (response as unknown as HclOrganizationItem);
    return success(
      this.factory.parseCompanyRegistrationRequest(
        this.context,
        data,
      ) as CompanyRegistrationFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CompanyRegistrationQueryCheckRegistrationStatusSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public override async checkRequestStatus(
    payload: CompanyRegistrationQueryCheckRegistrationStatus,
  ): Promise<Result<CompanyRegistrationRequest>> {
    debug('checkRequestStatus %s', payload.requestIdentifier.key);

    const raw = await this.client.callGet<HclOrganizationItem>(
      this.getOrganizationStatusUrl(payload.requestIdentifier.key),
      this.getOrganizationStatusParams(),
      { allowUndefined: true },
    );

    if (!raw) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.requestIdentifier,
      });
    }

    return success(
      this.factory.parseCompanyRegistrationRequest(this.context, raw),
    );
  }

  // ---------------------------------------------------------------------------
  // Extension points
  // ---------------------------------------------------------------------------

  protected getRegisterBuyerUrl(): string {
    return `${this.client.transactionBaseUrl}/organization/buyer`;
  }

  protected getRegisterBuyerBody(
    payload: CompanyRegistrationMutationRegister,
  ): Record<string, string> {
    const body: Record<string, string> = {
      org_orgEntityName: payload.name,
      org_orgEntityType: 'B',
      usr_logonId: payload.pointOfContact.email,
      usr_email1: payload.pointOfContact.email,
    };

    if (payload.taxIdentifier) {
      body['org_taxPayerId'] = payload.taxIdentifier;
    }
    if (payload.tinIdentifier) {
      body['org_legalId'] = payload.tinIdentifier;
    }

    return body;
  }

  protected getOrganizationStatusUrl(orgId: string): string {
    return `${this.client.transactionBaseUrl}/organization/${encodeURIComponent(orgId)}`;
  }

  protected getOrganizationStatusParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('profileName', 'IBM_Organization_Details');
    return params;
  }
}
