import {
  type AnyEmployeeInvitationPaginatedListSchema,
  type AnyEmployeeInvitationSchema,
  type AnyEmployeeIssuedInvitationSchema,
  CompanyIdentifierSchema,
  type EmployeeInvitation,
  type EmployeeInvitationFactory,
  type EmployeeInvitationMutationInviteEmployee,
  type EmployeeInvitationPaginatedList,
  type EmployeeInvitationPaginatedListSchema,
  type EmployeeInvitationQueryList,
  type EmployeeInvitationSchema,
  EmployeeInvitationStatusSchema,
  type EmployeeIssuedInvitation,
  type EmployeeIssuedInvitationSchema,
  type EmployeeRole,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import { decodeMagentoUid } from '../../core/company.api.js';
import { MagentoCompanyUserSchema } from '../../schema/company.types.js';
import {
  type MagentoCompanyRoleMapping,
  mapToMagentoRoleReference,
  parseMagentoEmployeeRole,
} from '../employee/employee-role.js';

/**
 * Magento invitations are addressed by the pair (company, customer) — the
 * same pair `acceptCompanyInvitation` needs next to the emailed code — so the
 * invitation key is `{companyId}:{customerId}` (numeric ids), optionally
 * followed by `:{roleId}` when the invitation link carries a role.
 */
export function makeMagentoInvitationKey(companyId: string, customerId: string): string {
  return `${decodeMagentoUid(companyId)}:${decodeMagentoUid(customerId)}`;
}

export interface MagentoInvitationKey {
  companyId: string;
  customerId?: string;
  roleId?: string;
}

/** Parses an invitation key; `null` when it has no company id. */
export function parseMagentoInvitationKey(key: string): MagentoInvitationKey | null {
  const [companyId, customerId, roleId] = key.split(':');
  if (!companyId) {
    return null;
  }
  return {
    companyId,
    customerId: customerId || undefined,
    roleId: roleId || undefined,
  };
}

/**
 * Magento invitations do not expire, and core has no "never" — the latest
 * representable date stands in, as in the other providers.
 */
const NEVER_EXPIRES = new Date(8640000000000000).toISOString();

export const MagentoEmployeeInvitationInputSchema = z.object({
  key: z.string(),
  company: CompanyIdentifierSchema,
  user: MagentoCompanyUserSchema,
  status: EmployeeInvitationStatusSchema,
});

export type MagentoEmployeeInvitationInput = z.infer<typeof MagentoEmployeeInvitationInputSchema>;

export const MagentoEmployeeInvitationPaginatedListInputSchema = z.object({
  items: z.array(MagentoEmployeeInvitationInputSchema),
  totalCount: z.number(),
});

export class MagentoEmployeeInvitationFactory<
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
  protected roleMapping: MagentoCompanyRoleMapping;

  /**
   * @param roleMapping `MagentoConfiguration.companyRoleMapping`.
   */
  constructor(
    employeeInvitationSchema: TEmployeeInvitationSchema,
    employeeIssuedInvitationSchema: TEmployeeIssuedInvitationSchema,
    employeeInvitationPaginatedListSchema: TEmployeeInvitationPaginatedListSchema,
    roleMapping: MagentoCompanyRoleMapping = {},
  ) {
    this.employeeInvitationSchema = employeeInvitationSchema;
    this.employeeIssuedInvitationSchema = employeeIssuedInvitationSchema;
    this.employeeInvitationPaginatedListSchema = employeeInvitationPaginatedListSchema;
    this.roleMapping = roleMapping;
  }

  protected toInvitation(
    input: MagentoEmployeeInvitationInput,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): EmployeeInvitation {
    return {
      identifier: { key: input.key },
      company: input.company,
      status: input.status,
      email: input.user.email ?? payload?.email ?? '',
      // A role the caller asked for wins over the one Magento echoes back:
      // without a mapping for it, Magento's role would read as `employee`.
      role: payload?.role ?? parseMagentoEmployeeRole(input.user.role, false, this.roleMapping),
      validUntil: NEVER_EXPIRES,
    };
  }

  public parseEmployeeInvitation(
    _context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeInvitationSchema> {
    const input = MagentoEmployeeInvitationInputSchema.parse(data);
    return this.employeeInvitationSchema.parse(this.toInvitation(input, payload));
  }

  /**
   * Magento emails the invitation code straight to the invitee and never
   * returns it over the API, so `securityToken` is always empty.
   */
  public parseEmployeeIssuedInvitation(
    _context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeIssuedInvitationSchema> {
    const input = MagentoEmployeeInvitationInputSchema.parse(data);
    const result = {
      ...this.toInvitation(input, payload),
      securityToken: '',
    } satisfies EmployeeIssuedInvitation;
    return this.employeeIssuedInvitationSchema.parse(result);
  }

  public parseEmployeeInvitationPaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeInvitationQueryList,
  ): z.output<TEmployeeInvitationPaginatedListSchema> {
    const input = MagentoEmployeeInvitationPaginatedListInputSchema.parse(data);
    const items = input.items.map((item) => this.parseEmployeeInvitation(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: input.totalCount,
      totalPages: Math.ceil(input.totalCount / pageSize),
      items,
    } satisfies EmployeeInvitationPaginatedList;

    return this.employeeInvitationPaginatedListSchema.parse(result);
  }

  public mapRole(role: EmployeeRole): string {
    return mapToMagentoRoleReference(role, this.roleMapping);
  }
}
