import type {
  EmployeePaginatedListSchema,
  EmployeeSchema} from '@reactionary/core';
import {
  type AnyEmployeePaginatedListSchema,
  type AnyEmployeeSchema,
  type CompanyIdentifier,
  type Employee,
  type EmployeeFactory,
  type EmployeePaginatedList,
  type EmployeeQueryList,
  type EmployeeRole,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaRawEmployeeCustomer {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface MedusaRawEmployee {
  id: string;
  role: string;
  spending_limit?: number;
  company_id: string;
  customer?: MedusaRawEmployeeCustomer | null;
}

export interface ParseEmployeeInput {
  company: CompanyIdentifier;
  employee: MedusaRawEmployee;
}

export class MedusaEmployeeFactory<
  TEmployeeSchema extends AnyEmployeeSchema = typeof EmployeeSchema,
  TEmployeePaginatedListSchema extends
    AnyEmployeePaginatedListSchema = typeof EmployeePaginatedListSchema,
> implements EmployeeFactory<TEmployeeSchema, TEmployeePaginatedListSchema>
{
  public readonly employeeSchema: TEmployeeSchema;
  public readonly employeePaginatedListSchema: TEmployeePaginatedListSchema;

  constructor(
    employeeSchema: TEmployeeSchema,
    employeePaginatedListSchema: TEmployeePaginatedListSchema,
  ) {
    this.employeeSchema = employeeSchema;
    this.employeePaginatedListSchema = employeePaginatedListSchema;
  }

  public parseEmployee(
    _context: RequestContext,
    data: ParseEmployeeInput,
  ): z.output<TEmployeeSchema> {
    const customer = data.employee.customer;

    const result = {
      identifier: { userId: customer?.id ?? '' },
      company: data.company,
      firstName: customer?.first_name ?? undefined,
      lastName: customer?.last_name ?? undefined,
      email: customer?.email ?? '',
      role: this.parseRole(data.employee.role),
    } satisfies Employee;

    return this.employeeSchema.parse(result);
  }

  public parseEmployeePaginatedList(
    context: RequestContext,
    data: { items: ParseEmployeeInput[]; totalCount: number },
    query: EmployeeQueryList,
  ): z.output<TEmployeePaginatedListSchema> {
    const items = data.items.map((item) => this.parseEmployee(context, item));
    const { pageNumber, pageSize } = query.search.paginationOptions;

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: data.totalCount,
      totalPages: Math.ceil(data.totalCount / pageSize),
      items,
    } satisfies EmployeePaginatedList;

    return this.employeePaginatedListSchema.parse(result);
  }

  public mapRole(role: EmployeeRole): string {
    return role;
  }

  protected parseRole(role: string): EmployeeRole {
    return role as EmployeeRole;
  }
}
