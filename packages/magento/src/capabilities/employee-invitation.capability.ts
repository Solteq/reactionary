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
  type EmployeeInvitationPaginatedList,
  EmployeeInvitationPaginatedListSchema,
  type EmployeeInvitationQueryList,
  EmployeeInvitationQueryListSchema,
  EmployeeInvitationSchema,
  type EmployeeIssuedInvitation,
  EmployeeIssuedInvitationSchema,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import {
  companyFailure,
  decodeMagentoUid,
  encodeMagentoUid,
  MagentoCompanyApi,
  NOT_A_COMPANY_USER_MESSAGE,
  notSupportedFailure,
} from '../core/company.api.js';
import {
  type MagentoCompanyIdentifier,
  matchesMagentoCompany,
  toMagentoCompanyIdentifier,
} from '../factories/company/company.factory.js';
import {
  type MagentoEmployeeInvitationFactory,
  type MagentoEmployeeInvitationInput,
  makeMagentoInvitationKey,
  parseMagentoInvitationKey,
} from '../factories/employee-invitation/employee-invitation.factory.js';
import { findMagentoCompanyRole } from '../factories/employee/employee-role.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:employee-invitation');

const NO_INVITATION_ENTITY =
  'Magento has no invitation entity: invitation codes are emailed by createCompanyUser and are neither stored for listing nor revocable';

const PLACEHOLDER = 'N/A';

/**
 * Adobe Commerce B2B company invitations.
 *
 * - `inviteEmployee` is `createCompanyUser`. For an email that already
 *   belongs to a customer outside any company, Magento emails that customer
 *   an invitation code; for a new email it creates the account (and company
 *   user) straight away and emails a welcome message. Either way the code is
 *   never returned, so `securityToken` is empty. Magento requires a name, job
 *   title and telephone that the core invitation does not carry: these come
 *   from `companyUserDefaults`.
 * - `acceptInvitation` is `acceptCompanyInvitation` (Adobe Commerce 2.4.7+),
 *   with the emailed code as `securityToken`. The invitation key is
 *   `{companyId}:{customerId}[:{roleId}]`, taken from the invitation link;
 *   without a customer id, the signed-in customer accepts.
 * - Magento keeps no invitation records, so invitations can be neither listed
 *   nor revoked.
 */
export class MagentoEmployeeInvitationCapability<
  TFactory extends EmployeeInvitationFactory = MagentoEmployeeInvitationFactory,
> extends EmployeeInvitationCapability {
  protected config: MagentoConfiguration;
  protected factory: EmployeeInvitationFactoryWithOutput<TFactory>;
  protected companyApi: MagentoCompanyApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: EmployeeInvitationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.companyApi = new MagentoCompanyApi(magentoApi);
  }

  /** The `createCompanyUser` fields core does not carry. */
  protected getUserDefaults(email: string): {
    firstname: string;
    lastname: string;
    job_title: string;
    telephone: string;
  } {
    const defaults = this.config.companyUserDefaults ?? {};
    return {
      firstname: defaults.firstName || email.split('@')[0] || PLACEHOLDER,
      lastname: defaults.lastName || PLACEHOLDER,
      job_title: defaults.jobTitle || PLACEHOLDER,
      telephone: defaults.telephone || PLACEHOLDER,
    };
  }

  /**
   * The identifier of the company an invitation was accepted into: exact
   * when the signed-in customer's current company is that company, otherwise
   * the Magento uid (which is what the identifier falls back to without a
   * VAT id anyway).
   */
  protected async resolveAcceptedCompany(
    companyId: string,
    signedIn: boolean,
  ): Promise<MagentoCompanyIdentifier> {
    const uid = encodeMagentoUid(companyId);
    if (signedIn) {
      try {
        const company = await this.companyApi.getCurrentCompany();
        if (company && decodeMagentoUid(company.id) === decodeMagentoUid(uid)) {
          return toMagentoCompanyIdentifier(company);
        }
      } catch (err) {
        debug('Could not read the company after accepting the invitation: %O', err);
      }
    }
    return { taxIdentifier: uid, key: uid };
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationInviteEmployeeSchema,
    outputSchema: EmployeeIssuedInvitationSchema,
  })
  public async inviteEmployee(
    payload: EmployeeInvitationMutationInviteEmployee,
  ): Promise<Result<EmployeeIssuedInvitation>> {
    debug('inviteEmployee as %s', payload.role);
    const reference = this.factory.mapRole(payload.role);
    if (!reference) {
      return companyFailure({
        type: 'InvalidInput',
        error:
          payload.role === 'admin'
            ? 'Magento cannot invite a company administrator; a company has exactly one'
            : `No Magento company role is configured for "${payload.role}" (set companyRoleMapping.${payload.role})`,
      });
    }

    try {
      const company = await this.companyApi.getCurrentCompany();
      if (!company) {
        return companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
      }
      if (!matchesMagentoCompany(payload.company, company)) {
        return companyFailure({ type: 'NotFound', identifier: payload.company });
      }

      const roles = await this.companyApi.getCompanyRoles();
      const role = roles ? findMagentoCompanyRole(roles, reference) : undefined;
      if (!role) {
        return companyFailure({
          type: 'InvalidInput',
          error: `The company has no Magento role "${reference}" (companyRoleMapping.${payload.role})`,
        });
      }

      const user = await this.companyApi.createCompanyUser({
        email: payload.email,
        ...this.getUserDefaults(payload.email),
        role_id: role.id,
        status: 'ACTIVE',
      });

      const input: MagentoEmployeeInvitationInput = {
        key: makeMagentoInvitationKey(company.id, user?.id ?? ''),
        company: toMagentoCompanyIdentifier(company),
        user: { ...user, email: user?.email ?? payload.email, role: user?.role ?? role },
        status: 'invited',
      };
      return success(this.factory.parseEmployeeIssuedInvitation(this.context, input, payload));
    } catch (err) {
      return handleMagentoProviderError('invite employee', err, payload.company);
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationAcceptInvitationSchema,
    outputSchema: EmployeeInvitationSchema,
  })
  public async acceptInvitation(
    payload: EmployeeInvitationMutationAcceptInvitation,
  ): Promise<Result<EmployeeInvitation>> {
    debug('acceptInvitation %o', payload.invitationIdentifier);
    const key = parseMagentoInvitationKey(payload.invitationIdentifier.key);
    if (!key) {
      return companyFailure({
        type: 'InvalidInput',
        error: 'The invitation key must be "{companyId}:{customerId}[:{roleId}]"',
      });
    }

    try {
      const signedInId = await this.magentoApi.getCustomerId();
      if (signedInId !== null) {
        const me = await this.magentoApi.getMe();
        if (me.email.toLowerCase() !== payload.currentUserEmail.toLowerCase()) {
          return companyFailure({
            type: 'InvalidInput',
            error: 'currentUserEmail does not match the signed-in customer',
          });
        }
      }

      const customerId = key.customerId ?? (signedInId !== null ? String(signedInId) : undefined);
      if (!customerId) {
        return companyFailure({
          type: 'InvalidInput',
          error: 'The invitation key has no customer id and no customer is signed in',
        });
      }
      if (signedInId !== null && decodeMagentoUid(customerId) !== String(signedInId)) {
        return companyFailure({
          type: 'InvalidInput',
          error: 'The invitation was issued to a different customer than the signed-in one',
        });
      }

      const accepted = await this.companyApi.acceptCompanyInvitation({
        code: payload.securityToken,
        role_id: key.roleId ? encodeMagentoUid(key.roleId) : undefined,
        user: {
          company_id: encodeMagentoUid(key.companyId),
          customer_id: encodeMagentoUid(customerId),
          status: 'ACTIVE',
        },
      });
      if (!accepted) {
        return companyFailure({
          type: 'Generic',
          message: 'Failed to accept invitation: Magento did not add the customer to the company',
        });
      }

      const input: MagentoEmployeeInvitationInput = {
        key: makeMagentoInvitationKey(key.companyId, customerId),
        company: await this.resolveAcceptedCompany(key.companyId, signedInId !== null),
        user: {
          id: encodeMagentoUid(customerId),
          email: payload.currentUserEmail,
          role: key.roleId ? { id: encodeMagentoUid(key.roleId) } : null,
        },
        status: 'accepted',
      };
      return success(this.factory.parseEmployeeInvitation(this.context, input));
    } catch (err) {
      return handleMagentoProviderError('accept invitation', err, payload.invitationIdentifier);
    }
  }

  @Reactionary({
    inputSchema: EmployeeInvitationMutationRevokeInvitationSchema,
  })
  public async revokeInvitation(
    payload: EmployeeInvitationMutationRevokeInvitation,
  ): Promise<Result<void, NotFoundError>> {
    debug('revokeInvitation %o', payload);
    return notSupportedFailure('revokeInvitation', NO_INVITATION_ENTITY);
  }

  @Reactionary({
    inputSchema: EmployeeInvitationQueryListSchema,
    outputSchema: EmployeeInvitationPaginatedListSchema,
  })
  public async listInvitations(
    payload: EmployeeInvitationQueryList,
  ): Promise<Result<EmployeeInvitationPaginatedList>> {
    debug('listInvitations %o', payload);
    return notSupportedFailure('listInvitations', NO_INVITATION_ENTITY);
  }
}
