import {
  type AnyEmployeePaginatedListSchema,
  type AnyEmployeeSchema,
  CompanyIdentifierSchema,
  type Employee,
  type EmployeeFactory,
  type EmployeePaginatedList,
  type EmployeePaginatedListSchema,
  type EmployeeQueryList,
  type EmployeeRole,
  type EmployeeSchema,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import { decodeMagentoUid } from '../../core/company.api.js';
import {
  MagentoCompanyAdminSchema,
  MagentoCompanyUserSchema,
} from '../../schema/company.types.js';
import {
  isMagentoCompanyAdmin,
  type MagentoCompanyRoleMapping,
  mapToMagentoRoleReference,
  parseMagentoEmployeeRole,
} from './employee-role.js';

/**
 * A company user together with what is needed to place it: the core company
 * identifier it belongs to, and the company administrator (to tell the
 * `admin` role apart, as Magento has no role for it).
 */
export const MagentoEmployeeInputSchema = z.object({
  company: CompanyIdentifierSchema,
  user: MagentoCompanyUserSchema,
  companyAdmin: MagentoCompanyAdminSchema.nullish(),
});

export type MagentoEmployeeInput = z.infer<typeof MagentoEmployeeInputSchema>;

export const MagentoEmployeePaginatedListInputSchema = z.object({
  items: z.array(MagentoEmployeeInputSchema),
  totalCount: z.number(),
});

export type MagentoEmployeePaginatedListInput = z.infer<
  typeof MagentoEmployeePaginatedListInputSchema
>;

export class MagentoEmployeeFactory<
  TEmployeeSchema extends AnyEmployeeSchema = typeof EmployeeSchema,
  TEmployeePaginatedListSchema extends
    AnyEmployeePaginatedListSchema = typeof EmployeePaginatedListSchema,
> implements EmployeeFactory<TEmployeeSchema, TEmployeePaginatedListSchema>
{
  public readonly employeeSchema: TEmployeeSchema;
  public readonly employeePaginatedListSchema: TEmployeePaginatedListSchema;
  protected roleMapping: MagentoCompanyRoleMapping;

  /**
   * @param roleMapping `MagentoConfiguration.companyRoleMapping`; without it
   * every user except the company administrator is an `employee`.
   */
  constructor(
    employeeSchema: TEmployeeSchema,
    employeePaginatedListSchema: TEmployeePaginatedListSchema,
    roleMapping: MagentoCompanyRoleMapping = {},
  ) {
    this.employeeSchema = employeeSchema;
    this.employeePaginatedListSchema = employeePaginatedListSchema;
    this.roleMapping = roleMapping;
  }

  public parseEmployee(_context: RequestContext, data: unknown): z.output<TEmployeeSchema> {
    const input = MagentoEmployeeInputSchema.parse(data);
    const user = input.user;

    const result = {
      // Numeric customer id, as everywhere else in the Magento provider.
      identifier: { userId: user.id ? decodeMagentoUid(user.id) : '' },
      company: input.company,
      firstName: user.firstname ?? undefined,
      lastName: user.lastname ?? undefined,
      email: user.email ?? '',
      role: parseMagentoEmployeeRole(
        user.role,
        isMagentoCompanyAdmin(user, input.companyAdmin),
        this.roleMapping,
      ),
      // Magento B2B has no per-user spending limit.
      spendingLimit: undefined,
    } satisfies Employee;

    return this.employeeSchema.parse(result);
  }

  public parseEmployeePaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeQueryList,
  ): z.output<TEmployeePaginatedListSchema> {
    const input = MagentoEmployeePaginatedListInputSchema.parse(data);
    const items = input.items.map((item) => this.parseEmployee(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: input.totalCount,
      totalPages: Math.ceil(input.totalCount / pageSize),
      items,
    } satisfies EmployeePaginatedList;

    return this.employeePaginatedListSchema.parse(result);
  }

  /**
   * The Magento role (id or name, as configured) for a core role, or an empty
   * string when none is configured. `admin` never maps: the company
   * administrator is not a role in Magento.
   */
  public mapRole(role: EmployeeRole): string {
    return mapToMagentoRoleReference(role, this.roleMapping);
  }
}
