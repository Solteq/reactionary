import type { Associate } from '@commercetools/platform-sdk';
import type {
  EmployeePaginatedListSchema,
  EmployeeSchema,
} from '@reactionary/core';
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

type ParseEmployeeInput = {
  organization: CompanyIdentifier;
  associate: Associate;
};


export type CommercetoolsEmployeeFactoryPaginatedInput = {
  items: Associate[];
  totalCount: number;
};

export class CommercetoolsEmployeeFactory<
  TEmployeeSchema extends AnyEmployeeSchema = typeof EmployeeSchema,
  TEmployeePaginatedListSchema extends AnyEmployeePaginatedListSchema = typeof EmployeePaginatedListSchema,
> implements EmployeeFactory<TEmployeeSchema, TEmployeePaginatedListSchema> {
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
    input: ParseEmployeeInput,
  ): z.output<TEmployeeSchema> {
    const result = {
      identifier: { userId: input.associate.customer.id },
      organization: input.organization,
      firstName: input.associate.customer.obj?.firstName,
      lastName: input.associate.customer.obj?.lastName,
      email: input.associate.customer.obj?.email || '',
      role: this.parseRole(input.associate.associateRoleAssignments[0]?.associateRole.key),
    } satisfies Employee;

    return this.employeeSchema.parse(result);
  }

  public parseEmployeePaginatedList(
    context: RequestContext,
    data: CommercetoolsEmployeeFactoryPaginatedInput,
    query: EmployeeQueryList,
  ): z.output<TEmployeePaginatedListSchema> {
    const totalPages = query.search.paginationOptions.pageSize > 0 ? Math.ceil(data.totalCount / query.search.paginationOptions.pageSize) : 0;

    const result = {
      identifier: query.search,
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: data.totalCount,
      totalPages,
      items: data.items.map((associate) => this.parseEmployee(context, {
        organization: query.search.organization,
        associate: associate,
      })),
    } satisfies EmployeePaginatedList;

    return this.employeePaginatedListSchema.parse(result);
  }

  public mapRole(role: EmployeeRole): string {
    switch(role) {
      case 'admin':
        return 'buyer-admin';
      case 'manager':
        return 'buyer-approver';
      case 'employee':
        return 'buyer';
    }

    return 'buyer';
  }

  protected parseRole(role: string | undefined): EmployeeRole {
    switch(role) {
      case 'buyer-admin':
        return 'admin';
      case 'buyer-approver':
        return 'manager';
      case 'buyer':
        return 'employee';
    }


    return 'employee';
  }
}
