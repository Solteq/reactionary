import { FetchError } from '@medusajs/js-sdk';
import {
  type Cache,
  type EmployeeInvitation,
  EmployeeInvitationCapability,
  type EmployeeInvitationFactory,
  type EmployeeInvitationFactoryWithOutput,
  type EmployeeInvitationMutationAcceptInvitation,
  EmployeeInvitationMutationAcceptInvitationSchema,
  type EmployeeInvitationMutationInviteEmployee,
  EmployeeInvitationMutationInviteEmployeeSchema,
  type EmployeeInvitationMutationRevokeInvitation,
  EmployeeInvitationMutationRevokeInvitationSchema,
  EmployeeInvitationSchema,
  type EmployeeInvitationPaginatedList,
  EmployeeInvitationPaginatedListSchema,
  type EmployeeInvitationQueryList,
  EmployeeInvitationQueryListSchema,
  type EmployeeIssuedInvitation,
  EmployeeIssuedInvitationSchema,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import {
  type MedusaEmployeeInvitationFactory,
  type MedusaRawEmployeeInvitation,
  parseInvitationKey,
} from '../factories/employee-invitation/employee-invitation.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:employee-invitation');

const EMPLOYEE_INVITATION_FIELDS = [
  'id',
  'email',
  'role',
  'status',
  'company_id',
  'company.tax_identifier',
  'accepted_at',
  'validUntil',
].join(',');

export class MedusaEmployeeInvitationCapability<
  TFactory extends EmployeeInvitationFactory = MedusaEmployeeInvitationFactory,
> extends EmployeeInvitationCapability {
  protected config: MedusaConfiguration;
  protected factory: EmployeeInvitationFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: EmployeeInvitationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  // company.taxIdentifier is the real, caller-chosen business tax id - not the Medusa-internal company
  // id the REST API is keyed by - so it has to be resolved to that id before it can be used in a path.
  protected async resolveCompanyId(taxIdentifier: string): Promise<string | null> {
    const client = await this.medusaApi.getClient();
    try {
      const response = await client.client.fetch<{ company: { id: string } }>(
        `/store/companies/by-tax-identifier/${taxIdentifier}`,
        { method: 'GET' },
      );
      return response.company.id;
    } catch (err) {
      if (err instanceof FetchError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  // The accept-invitation route returns the raw workflow result rather than a query.graph response, so
  // it never includes the nested `company` relation (only the `company_id` scalar column) - this is
  // used to look the company back up by that id, purely to read its real tax_identifier.
  protected async fetchCompany(companyId: string): Promise<{ tax_identifier: string } | null> {
    const client = await this.medusaApi.getClient();
    try {
      const response = await client.client.fetch<{ company: { tax_identifier: string } }>(
        `/store/companies/${companyId}`,
        { method: 'GET', query: { fields: 'tax_identifier' } },
      );
      return response.company;
    } catch (err) {
      if (err instanceof FetchError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationInviteEmployeeSchema,
    outputSchema: EmployeeIssuedInvitationSchema,
  })
  public async inviteEmployee(
    payload: EmployeeInvitationMutationInviteEmployee,
  ): Promise<Result<EmployeeIssuedInvitation>> {
    debug('inviteEmployee', payload);
    try {
      const companyId = await this.resolveCompanyId(payload.company.taxIdentifier);
      if (!companyId) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }

      const client = await this.medusaApi.getClient();
      const response = await client.client.fetch<{
        employee_invitation: MedusaRawEmployeeInvitation;
      }>(`/store/companies/${companyId}/employee-invitations`, {
        method: 'POST',
        body: {
          email: payload.email,
          role: this.factory.mapRole(payload.role),
        },
        query: { fields: EMPLOYEE_INVITATION_FIELDS },
      });

      return success(
        this.factory.parseEmployeeIssuedInvitation(
          this.context,
          response.employee_invitation,
          payload,
        ),
      );
    } catch (err) {
      handleProviderError('invite employee', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationAcceptInvitationSchema,
    outputSchema: EmployeeInvitationSchema,
  })
  public async acceptInvitation(
    payload: EmployeeInvitationMutationAcceptInvitation,
  ): Promise<Result<EmployeeInvitation>> {
    debug('acceptInvitation', payload);
    try {
      // ponytail: the backend has no invitation secret to verify - payload.securityToken is accepted for
      // core contract compatibility but intentionally unused here. Authorization comes entirely from the
      // invitee's authenticated session, matched server-side against the invitation's email.
      const { invitationId } = parseInvitationKey(payload.invitationIdentifier.key);

      const client = await this.medusaApi.getClient();
      const response = await client.client.fetch<{
        employee_invitation: MedusaRawEmployeeInvitation;
      }>(`/store/employee-invitations/${invitationId}/accept`, {
        method: 'POST',
      });

      // this route returns the raw workflow result, not a query.graph response, so it never carries the
      // nested `company` relation the factory needs for the public taxIdentifier field - fetch it.
      const company = await this.fetchCompany(response.employee_invitation.company_id);

      return success(
        this.factory.parseEmployeeInvitation(this.context, {
          ...response.employee_invitation,
          company: company ?? undefined,
        }),
      );
    } catch (err) {
      handleProviderError('accept invitation', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationRevokeInvitationSchema,
  })
  public async revokeInvitation(
    payload: EmployeeInvitationMutationRevokeInvitation,
  ): Promise<Result<void, NotFoundError>> {
    debug('revokeInvitation', payload);
    try {
      const { companyId, invitationId } = parseInvitationKey(
        payload.invitationIdentifier.key,
      );

      const client = await this.medusaApi.getClient();
      await client.client.fetch(
        `/store/companies/${companyId}/employee-invitations/${invitationId}`,
        { method: 'DELETE' },
      );

      return success(undefined);
    } catch (err) {
      handleProviderError('revoke invitation', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationQueryListSchema,
    outputSchema: EmployeeInvitationPaginatedListSchema,
  })
  public async listInvitations(
    payload: EmployeeInvitationQueryList,
  ): Promise<Result<EmployeeInvitationPaginatedList>> {
    debug('listInvitations', payload);
    try {
      const client = await this.medusaApi.getClient();
      const { pageNumber, pageSize } = payload.search.paginationOptions;

      let response: { employee_invitations: MedusaRawEmployeeInvitation[]; count: number };
      if (payload.search.company) {
        const companyId = await this.resolveCompanyId(payload.search.company.taxIdentifier);
        if (!companyId) {
          return error<NotFoundError>({ type: 'NotFound', identifier: payload.search.company });
        }

        response = await client.client.fetch(
          `/store/companies/${companyId}/employee-invitations`,
          {
            method: 'GET',
            query: {
              fields: EMPLOYEE_INVITATION_FIELDS,
              email: payload.search.email,
              limit: pageSize,
              offset: (pageNumber - 1) * pageSize,
            },
          },
        );
      } else if (payload.search.email) {
        // ponytail: this backend route is invitee-facing only - it always scopes to the current
        // session's own email server-side, so the caller must be authenticated as that invitee. It also
        // doesn't fetch `company.tax_identifier`, so items from this branch parse with an empty
        // company.taxIdentifier. Upgrade path: add that field to this route's hardcoded field list.
        response = await client.client.fetch('/store/employee-invitations', {
          method: 'GET',
        });
      } else {
        response = { employee_invitations: [], count: 0 };
      }

      return success(
        this.factory.parseEmployeeInvitationPaginatedList(
          this.context,
          { items: response.employee_invitations, totalCount: response.count },
          payload,
        ),
      );
    } catch (err) {
      handleProviderError('list invitations', err);
    }
  }
}
