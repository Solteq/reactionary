import type {
  EmployeeInvitationFactory,
  EmployeeInvitation,
  EmployeeInvitationPaginatedList,
  EmployeeIssuedInvitation,
  EmployeeInvitationMutationInviteEmployee,
  EmployeeInvitationQueryList,
  EmployeeRole,
  RequestContext,
} from '@reactionary/core';
import {
  EmployeeInvitationPaginatedListSchema,
  EmployeeInvitationSchema,
  EmployeeIssuedInvitationSchema,
} from '@reactionary/core';
import type { CommercetoolsEmployeeInviteCustomObject } from '../../schema/commercetools.schema.js';

export const COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS = 'reactionary-employee-invitation';
export const COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX = 'reactionary-employee-invitation-index';

export type CommercetoolsEmployeeInvitationFactoryIssuedInvitationInput = {
  invite: CommercetoolsEmployeeInviteCustomObject;
  securityToken: string;
};

export class CommercetoolsEmployeeInvitationFactory implements EmployeeInvitationFactory {
  public employeeInvitationSchema = EmployeeInvitationSchema;
  public employeeIssuedInvitationSchema = EmployeeIssuedInvitationSchema;
  public employeeInvitationPaginatedListSchema = EmployeeInvitationPaginatedListSchema;

  public parseEmployeeInvitation(
    context: RequestContext,
    data: CommercetoolsEmployeeInviteCustomObject,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): EmployeeInvitation {
    void context;
    void payload;

     const result = {
      identifier: {
        key: data.key,
      },
      company: data.value.company,
      status: data.value.status,
      email: data.value.email,
      role: data.value.role,
      validUntil: data.value.validUntil,
    } satisfies EmployeeInvitation;

    return EmployeeInvitationSchema.parse(result);
  }

  public parseEmployeeIssuedInvitation(
    context: RequestContext,
    data: CommercetoolsEmployeeInvitationFactoryIssuedInvitationInput,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): EmployeeIssuedInvitation {
    const invitation = this.parseEmployeeInvitation(context, data.invite, payload);
    const result = {
      ...invitation,
      securityToken: data.securityToken,
    } satisfies EmployeeIssuedInvitation;

    return EmployeeIssuedInvitationSchema.parse(result);
  }

  public parseEmployeeInvitationPaginatedList(
    context: RequestContext,
    data: CommercetoolsEmployeeInviteCustomObject[],
    query: EmployeeInvitationQueryList,
  ): EmployeeInvitationPaginatedList {
    const totalPages = query.search.paginationOptions.pageSize > 0
      ? Math.ceil(data.length / query.search.paginationOptions.pageSize)
      : 0;

    const result = {
      identifier: query.search,
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: data.length,
      totalPages,
      items: data.map((invitation) => this.parseEmployeeInvitation(context, invitation)),
    } satisfies EmployeeInvitationPaginatedList;

    return EmployeeInvitationPaginatedListSchema.parse(result);
  }


  public mapRole(role: EmployeeRole): string {
    switch (role) {
      case 'admin':
        return 'buyer-admin';
      case 'manager':
        return 'buyer-approver';
      case 'employee':
        return 'buyer';
    }

    return 'buyer';
  }
}
