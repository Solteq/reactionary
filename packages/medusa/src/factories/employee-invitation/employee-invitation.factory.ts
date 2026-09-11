import type {
  EmployeeInvitationPaginatedListSchema,
  EmployeeInvitationSchema,
  EmployeeIssuedInvitationSchema} from '@reactionary/core';
import {
  type AnyEmployeeInvitationPaginatedListSchema,
  type AnyEmployeeInvitationSchema,
  type AnyEmployeeIssuedInvitationSchema,
  type EmployeeInvitation,
  type EmployeeInvitationFactory,
  type EmployeeInvitationQueryList,
  type EmployeeInvitationMutationInviteEmployee,
  type EmployeeInvitationPaginatedList,
  type EmployeeInvitationStatus,
  type EmployeeIssuedInvitation,
  type EmployeeRole,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaRawEmployeeInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  company_id: string;
  company?: { tax_identifier: string };
  validUntil?: string | Date | null;
}

/**
 * The backend's revoke route needs both a company id and an invitation id, and there is no
 * company-agnostic single-invitation lookup route for an authenticated store customer, so both
 * are encoded into the opaque EmployeeInvitationIdentifier.key. Medusa ids never contain ':'.
 */
export function makeInvitationKey(companyId: string, invitationId: string): string {
  return `${companyId}:${invitationId}`;
}

export function parseInvitationKey(key: string): {
  companyId: string;
  invitationId: string;
} {
  const separatorIndex = key.indexOf(':');
  return {
    companyId: key.slice(0, separatorIndex),
    invitationId: key.slice(separatorIndex + 1),
  };
}

// ponytail: core requires a `validUntil` string even for invitations the backend leaves un-expiring
// (`validUntil: null`). There's no real "never expires" representation in the core contract, so we
// substitute the max representable date rather than inventing one.
const NEVER_EXPIRES = new Date(8640000000000000).toISOString();

export class MedusaEmployeeInvitationFactory<
  TEmployeeInvitationSchema extends
    AnyEmployeeInvitationSchema = typeof EmployeeInvitationSchema,
  TEmployeeIssuedInvitationSchema extends
    AnyEmployeeIssuedInvitationSchema = typeof EmployeeIssuedInvitationSchema,
  TEmployeeInvitationPaginatedListSchema extends
    AnyEmployeeInvitationPaginatedListSchema = typeof EmployeeInvitationPaginatedListSchema,
> implements
    EmployeeInvitationFactory<
      TEmployeeInvitationSchema,
      TEmployeeIssuedInvitationSchema,
      TEmployeeInvitationPaginatedListSchema
    >
{
  public readonly employeeInvitationSchema: TEmployeeInvitationSchema;
  public readonly employeeIssuedInvitationSchema: TEmployeeIssuedInvitationSchema;
  public readonly employeeInvitationPaginatedListSchema: TEmployeeInvitationPaginatedListSchema;

  constructor(
    employeeInvitationSchema: TEmployeeInvitationSchema,
    employeeIssuedInvitationSchema: TEmployeeIssuedInvitationSchema,
    employeeInvitationPaginatedListSchema: TEmployeeInvitationPaginatedListSchema,
  ) {
    this.employeeInvitationSchema = employeeInvitationSchema;
    this.employeeIssuedInvitationSchema = employeeIssuedInvitationSchema;
    this.employeeInvitationPaginatedListSchema = employeeInvitationPaginatedListSchema;
  }

  public parseEmployeeInvitation(
    _context: RequestContext,
    data: MedusaRawEmployeeInvitation,
    _payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeInvitationSchema> {
    // The encoded identifier key needs the Medusa-internal company id (always present, used to build
    // API paths later), while the public `company` field needs the real business tax identifier -
    // these are two different values and must not be conflated.
    const result = {
      identifier: { key: makeInvitationKey(data.company_id, data.id) },
      company: { taxIdentifier: data.company?.tax_identifier ?? '' },
      status: this.parseStatus(data.status),
      email: data.email,
      role: this.parseRole(data.role),
      validUntil: data.validUntil ? new Date(data.validUntil).toISOString() : NEVER_EXPIRES,
    } satisfies EmployeeInvitation;

    return this.employeeInvitationSchema.parse(result);
  }

  public parseEmployeeIssuedInvitation(
    context: RequestContext,
    data: MedusaRawEmployeeInvitation,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeIssuedInvitationSchema> {
    const invitation = this.parseEmployeeInvitation(context, data, payload);

    // ponytail: the backend has no invitation secret to verify - this reuses the invitation's own id as
    // a stand-in securityToken so the core contract is satisfied. It is not cryptographically enforced;
    // acceptInvitation ignores whatever token is passed back in. Upgrade path: add a hashed-token column
    // and a verification step to the backend if real enforcement is ever needed.
    const result = {
      ...invitation,
      securityToken: data.id,
    } satisfies EmployeeIssuedInvitation;

    return this.employeeIssuedInvitationSchema.parse(result);
  }

  public parseEmployeeInvitationPaginatedList(
    context: RequestContext,
    data: { items: MedusaRawEmployeeInvitation[]; totalCount: number },
    query: EmployeeInvitationQueryList,
  ): z.output<TEmployeeInvitationPaginatedListSchema> {
    const items = data.items.map((item) => this.parseEmployeeInvitation(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: data.totalCount,
      totalPages: Math.ceil(data.totalCount / pageSize),
      items,
    } satisfies EmployeeInvitationPaginatedList;

    return this.employeeInvitationPaginatedListSchema.parse(result);
  }

  public mapRole(role: EmployeeRole): string {
    return role;
  }

  protected parseRole(role: string): EmployeeRole {
    return role as EmployeeRole;
  }

  protected parseStatus(status: string): EmployeeInvitationStatus {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'revoked':
        return 'revoked';
      default:
        return 'invited';
    }
  }
}
