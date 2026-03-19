import * as crypto from 'crypto';
import type {
  Associate,
  BusinessUnit,
  ByProjectKeyRequestBuilder,
  CustomObjectDraft,
} from '@commercetools/platform-sdk';
import type {
  Cache,
  EmployeeInvitationFactory,
  EmployeeInvitationFactoryWithOutput,
  NotFoundError,
  EmployeeInvitation,
  EmployeeInvitationQueryList,
  EmployeeInvitationStatus,
  EmployeeIssuedInvitation,
  EmployeeInvitationPaginatedList,
  EmployeeInvitationMutationAcceptInvitation,
  EmployeeInvitationMutationInviteEmployee,
  EmployeeInvitationMutationRevokeInvitation,
  CompanyIdentifier,
  PaginationOptions,
  RequestContext,
  Result,
  InvalidInputError,
} from '@reactionary/core';
import {
  error,
  EmployeeInvitationSchema,
  EmployeeInvitationPaginatedListSchema,
  EmployeeInvitationQueryListSchema,
  EmployeeIssuedInvitationSchema,
  EmployeeInvitationMutationAcceptInvitationSchema,
  EmployeeInvitationMutationInviteEmployeeSchema,
  EmployeeInvitationMutationRevokeInvitationSchema,
  EmployeeInvitationCapability,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import {
  COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS,
  COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX,
  type CommercetoolsEmployeeInvitationFactory,
} from '../factories/employee-invitation/employee-invitation.factory.js';
import type { CommercetoolsEmployeeInviteCustomObject, CommercetoolsEmployeeInviteCustomObjectValue } from '../schema/commercetools.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsEmployeeInvitationCapability<
  TFactory extends EmployeeInvitationFactory = CommercetoolsEmployeeInvitationFactory,
> extends EmployeeInvitationCapability {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: EmployeeInvitationFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: EmployeeInvitationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getAdminClient();
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      throw new Error('Only registered users can access employees capabilities');
    }
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .asAssociate()
      .withAssociateIdValue({
        associateId: this.context.session.identityContext.identity.id.userId,
      });
  }

  protected async getBusinessUnit(
    key: string,
    extraExpands: string[] = [],
  ): Promise<BusinessUnit | null> {
    const client = await this.getClient();
    const response = await client
      .businessUnits()
      .withKey({ key })
      .get({
        queryArgs: {
          expand: ['associates[*].customer', ...extraExpands],
        },
      })
      .execute()
      .catch((err) => {
        if (err.statusCode === 404) {
          return null;
        }
        throw err;
      });

    return response ? response.body : null;
  }

  protected findAssociateByEmail(
    businessUnit: BusinessUnit,
    email: string,
  ): Associate | undefined {
    return businessUnit.associates.find(
      (associate) => associate.customer.obj?.email === email,
    );
  }

  protected async getAdminClient() {
    const client = await this.commercetools.getAdminClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected makeKeyFromCompanyIdentifier(companyIdentifier: CompanyIdentifier): string {
    return 'org-' + Buffer.from(companyIdentifier.taxIdentifier).toString('base64');
  }

  protected makeKeyFromEmail(email: string): string {
    return `email-` + Buffer.from(email).toString('base64');
  }

  protected async fetchInvitationIdsByKey(adminClient: ByProjectKeyRequestBuilder, key: string): Promise<string[]> {
    const response = await adminClient.customObjects().withContainerAndKey({
        container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX,
        key: key,
    }).get().execute().catch((error) => {
      if (error?.statusCode === 404) {
        return null;
      }
      throw error;
    });
    if (!response) {
      return [];
    }
    return response.body.value.invitationIds;
  }

  protected async addInvitationToEntityIndex(adminClient: ByProjectKeyRequestBuilder, indexKey: string, invitationId: string): Promise<void> {
    const existingIds = await this.fetchInvitationIdsByKey(adminClient, indexKey);
    const newIds = Array.from(new Set([...existingIds, invitationId]));
    return adminClient.customObjects().post({
      body: {
        container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX,
        key: indexKey,
        value: {
          invitationIds: newIds,
        },
      },
    }).execute().then(() => undefined);
  }

  protected async addInvitationToEmailIndex(adminClient: ByProjectKeyRequestBuilder, email: string, invitationId: string): Promise<void> {
    return this.addInvitationToEntityIndex(adminClient, this.makeKeyFromEmail(email), invitationId);
  }

  protected async addInvitationToCompanyIndex(adminClient: ByProjectKeyRequestBuilder, companyIdentifier: CompanyIdentifier, invitationId: string): Promise<void> {
    return this.addInvitationToEntityIndex(adminClient, this.makeKeyFromCompanyIdentifier(companyIdentifier), invitationId);
  }

  protected async updateInvitationStatus(adminClient: ByProjectKeyRequestBuilder, invitationKey: string, invitation: CommercetoolsEmployeeInviteCustomObject, newStatus: EmployeeInvitationStatus): Promise<void> {
    if (!invitation) {
      throw new Error(`Invitation with key ${invitationKey} not found`);
    }
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      throw new Error('Only registered users can accept invitations');
    }
    await adminClient.customObjects().post({
      body: {
        container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS,
        key: invitationKey,
        value: {
          ...invitation.value,
          status: newStatus,
          ...(newStatus === 'accepted' ? {
            acceptedBy: this.context.session.identityContext.identity.id.userId,
            acceptedDate: new Date().toISOString(),
          } : {}),
          lastUpdatedBy: this.context.session.identityContext.identity.id.userId,
          lastUpdatedDate: new Date().toISOString(),
        }
      }
    }).execute();
  }

  protected async fetchInvitations(adminClient: ByProjectKeyRequestBuilder, indexKey: string, onlyActive: boolean, paginationOptions?: PaginationOptions): Promise<CommercetoolsEmployeeInviteCustomObject[]> {
    const result = [];
    let allInviteIds = await this.fetchInvitationIdsByKey(adminClient, indexKey);
    if (paginationOptions) {
      const start = (paginationOptions.pageNumber - 1) * paginationOptions.pageSize;
      const end = start + paginationOptions.pageSize;
      allInviteIds = allInviteIds.slice(start, end);
    }
    for (const invitationId of allInviteIds) {
      const invitationResponse = await adminClient.customObjects().withContainerAndKey({ container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS, key: invitationId }).get().execute().catch((error) => {
        if (error?.statusCode === 404) {
          return null;
        }
        throw error;
      })

      const invitation = invitationResponse?.body as CommercetoolsEmployeeInviteCustomObject | undefined;
      if (!invitation) {
        continue;
      }
      if (onlyActive && invitation.value.status !== 'invited') {
        continue;
      }

      if (onlyActive && new Date(invitation.value.validUntil) < new Date()) {
        continue;
      }

      result.push(invitation);
    }
    return result;
  }

  protected async fetchAllInvitationsForCompany(adminClient: ByProjectKeyRequestBuilder, companyIdentifier: CompanyIdentifier, onlyActive: boolean, paginationOptions?: PaginationOptions): Promise<CommercetoolsEmployeeInviteCustomObject[]> {
      return this.fetchInvitations(adminClient, this.makeKeyFromCompanyIdentifier(companyIdentifier), onlyActive, paginationOptions);
  }

  protected async fetchAllInvitationsForUser(adminClient: ByProjectKeyRequestBuilder, userEmail: string, onlyActive: boolean, paginationOptions?: PaginationOptions): Promise<CommercetoolsEmployeeInviteCustomObject[]> {
    return this.fetchInvitations(adminClient, this.makeKeyFromEmail(userEmail), onlyActive, paginationOptions);
  }

  protected async fetchInvitationByKey(adminClient: ByProjectKeyRequestBuilder, invitationKey: string): Promise<CommercetoolsEmployeeInviteCustomObject | null> {
    const inviteResponse = await adminClient.customObjects().withContainerAndKey({ container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS, key: invitationKey }).get().execute().catch((error) => {
      if (error?.statusCode === 404) {
        return null;
      }
      throw error;
    });

    if(!inviteResponse) {
      return null;
    }

    return inviteResponse.body as unknown as CommercetoolsEmployeeInviteCustomObject;
  }

  protected inviteEmployeePayload(
    payload: EmployeeInvitationMutationInviteEmployee,
    tokenHash: string,
  ): CustomObjectDraft {
    const key = payload.company.taxIdentifier;
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      throw new Error('Only registered users can invite employees');
    }
    const currentUser = this.context.session.identityContext.identity.id.userId;
    const inviteKey = crypto.randomUUID() + '-' + new Date().getTime();
    return {
      container: COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS,
      key: inviteKey,
      value: {
        tokenHash: tokenHash,
        businessUnitKey: key,
        status: 'invited',
        email: payload.email,
        role: payload.role,
        company: payload.company,
        validUntil: (new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
        invitedBy: '' + currentUser,
        invitedDate: new Date().toISOString(),
        lastUpdatedBy: '' + currentUser,
        lastUpdatedDate: new Date().toISOString()
      } satisfies CommercetoolsEmployeeInviteCustomObjectValue,
    }
  }

  protected async createTokenHash(rawToken: string) {
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return tokenHash;
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationInviteEmployeeSchema,
    outputSchema: EmployeeIssuedInvitationSchema,
  })
  public override async inviteEmployee(
    payload: EmployeeInvitationMutationInviteEmployee,
  ): Promise<Result<EmployeeIssuedInvitation>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const customer = this.findAssociateByEmail(businessUnit, payload.email);
    if (customer) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Customer with email ${payload.email} is already an associate of this company.`,
      });
    }

    const rawToken = crypto.randomUUID() + new Date().getTime() + payload.email + crypto.randomUUID();
    const tokenHash = await this.createTokenHash(rawToken);

    const adminClient = await this.getAdminClient();
    const addInviteResponse = await adminClient.customObjects().post({
      body: this.inviteEmployeePayload(payload, tokenHash)
    }).execute();

    await this.addInvitationToEmailIndex(adminClient, payload.email, addInviteResponse.body.key);
    await this.addInvitationToCompanyIndex(adminClient, payload.company, addInviteResponse.body.key);

    const invite = addInviteResponse.body as unknown as CommercetoolsEmployeeInviteCustomObject;
    return success(this.factory.parseEmployeeIssuedInvitation(this.context, { invite: invite, securityToken: rawToken }, payload));
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationAcceptInvitationSchema,
    outputSchema: EmployeeInvitationSchema,
  })
  public override async acceptInvitation(
    payload: EmployeeInvitationMutationAcceptInvitation,
  ): Promise<Result<EmployeeInvitation>> {

    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return error({
        type: 'Generic',
        message: 'Only registered users can accept invitations',
      });
    }

    const adminClient = await this.getAdminClient();
    const invitation = await this.fetchInvitationByKey(adminClient, payload.invitationIdentifier.key);
    if (!invitation) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.invitationIdentifier,
      });
    }

    if (invitation.value.status !== 'invited') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Invitation with key ${payload.invitationIdentifier.key} is not in an invited status and cannot be accepted.`,
      });
    }

    if (new Date(invitation.value.validUntil) < new Date()) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Invitation with key ${payload.invitationIdentifier.key} has expired and cannot be accepted.`,
      });
    }

    if (invitation.value.email !== payload.currentUserEmail) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Invitation with key ${payload.invitationIdentifier.key} was sent to ${invitation.value.email} but the current user email is ${payload.currentUserEmail}. Only the invited email can accept the invitation.`,
      });
    }
    const expectedHash = await this.createTokenHash(payload.securityToken);

    if (invitation.value.tokenHash !== expectedHash) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Invitation token is invalid.`,
      });
    }

    const businessUnit = await adminClient.businessUnits().withKey({ key: invitation.value.company.taxIdentifier }).get().execute().catch((error) => {
      if (error?.statusCode === 404) {
        return null;
      }
      throw error;
    });

    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: invitation.value.company,
      });
    }

    const associateId = this.context.session.identityContext.identity.id.userId;
    await adminClient.businessUnits().withKey({ key: invitation.value.company.taxIdentifier }).post({
      body: {
        version: businessUnit.body.version,
        actions: [
          {
            action: 'addAssociate',
            associate: {
              customer: {
                typeId: 'customer',
                id: associateId,
              },
              associateRoleAssignments: [
              {
                associateRole: {
                  typeId: 'associate-role',
                  key: this.factory.mapRole(invitation.value.role),
                }
              }
            ]
          }

        }
        ]
      }
    }).execute();

    await this.updateInvitationStatus(adminClient, payload.invitationIdentifier.key, invitation, 'accepted');
    const updatedInvitation = await this.fetchInvitationByKey(
      adminClient,
      payload.invitationIdentifier.key,
    );
    if (!updatedInvitation) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.invitationIdentifier,
      });
    }

    return success(this.factory.parseEmployeeInvitation(this.context, updatedInvitation));
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationRevokeInvitationSchema,
  })
  public override async revokeInvitation(
    payload: EmployeeInvitationMutationRevokeInvitation,
  ): Promise<Result<void, NotFoundError>> {
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return error({
        type: 'Generic',
        message: 'Only registered users can accept invitations',
      });
    }

    const adminClient = await this.getAdminClient();
    const invitation = await this.fetchInvitationByKey(adminClient, payload.invitationIdentifier.key);
    if (!invitation) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.invitationIdentifier,
      });
    }

    if (invitation.value.status !== 'invited') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Invitation with key ${payload.invitationIdentifier.key} is not in an invited status and cannot be rejected.`,
      });
    }

    await this.updateInvitationStatus(adminClient, payload.invitationIdentifier.key, invitation, 'revoked');
    return success(undefined)
  }

  @Reactionary({
    inputSchema: EmployeeInvitationQueryListSchema,
    outputSchema: EmployeeInvitationPaginatedListSchema,
  })
  public override async listInvitations(payload: EmployeeInvitationQueryList): Promise<Result<EmployeeInvitationPaginatedList>> {
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return error({
        type: 'Generic',
        message: 'Only registered users can accept invitations',
      });
    }
    const adminClient = await this.getAdminClient();
    if (payload.search.email) {
      const invitations = await this.fetchAllInvitationsForUser(adminClient, payload.search.email, false, payload.search.paginationOptions);
      return success(this.factory.parseEmployeeInvitationPaginatedList(this.context, invitations, payload));
    }
    if (payload.search.company) {
      const invitations = await this.fetchAllInvitationsForCompany(adminClient, payload.search.company, false, payload.search.paginationOptions);
      return success(this.factory.parseEmployeeInvitationPaginatedList(this.context, invitations, payload));
    }

    return success(this.factory.parseEmployeeInvitationPaginatedList(this.context, [], payload));
  }
}
