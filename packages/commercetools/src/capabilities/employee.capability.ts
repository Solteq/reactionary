import type {
  Associate,
  BusinessUnit,
  MyBusinessUnitUpdateAction
} from '@commercetools/platform-sdk';
import type {
  Cache,
  EmployeeFactory,
  EmployeeFactoryWithOutput,
  EmployeeMutationAssignRole,
  EmployeeMutationRemoveEmployee,
  EmployeeMutationUnassignRole,
  EmployeeQueryByEmail,
  EmployeeQueryList,
  NotFoundError,
  Employee,
  EmployeePaginatedList,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  EmployeeCapability,
  EmployeeMutationAssignRoleSchema,
  EmployeeMutationUnassignRoleSchema,
  EmployeeQueryByEmailSchema,
  EmployeeQueryListSchema,
  error,
  EmployeePaginatedListSchema,
  EmployeeSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import { type CommercetoolsEmployeeFactory } from '../factories/employee/employee.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsEmployeeCapability<
  TFactory extends EmployeeFactory = CommercetoolsEmployeeFactory,
> extends EmployeeCapability {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: EmployeeFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: EmployeeFactoryWithOutput<TFactory>,
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
    return client.withProjectKey({ projectKey: this.config.projectKey }).asAssociate().withAssociateIdValue({
      associateId: this.context.session.identityContext.identity.id.userId
    })
  }

  protected async getAdminClient() {
    const client = await this.commercetools.getAdminClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  public async getBusinessUnit(key: string, extraExpands: string[] = []): Promise<BusinessUnit | null> {
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

  protected async updateBusinessUnit(
    key: string,
    version: number,
    actions: MyBusinessUnitUpdateAction[],
  ): Promise<BusinessUnit> {
    const client = await this.getClient();
    const response = await client
      .businessUnits()
      .withKey({ key })
      .post({
        body: {
          version,
          actions,
        },
        queryArgs: {
          expand: ['associates[*].customer'],
        }
      })
      .execute();

    return response.body;
  }


  protected getAssociateRole(associate: Associate): string | undefined {
    return associate.associateRoleAssignments[0]?.associateRole.key;
  }

  protected getRoles(associate: Associate): string[] {
    return associate.associateRoleAssignments.map(
      (assignment) => assignment.associateRole.key,
    );
  }

  protected findAssociateByCustomerId(
    businessUnit: BusinessUnit,
    customerId: string,
  ): Associate | undefined {
    return businessUnit.associates.find(
      (associate) => associate.customer.id === customerId,
    );
  }

  public findAssociateByEmail(
    businessUnit: BusinessUnit,
    email: string,
  ): Associate | undefined {
    return businessUnit.associates.find(
      (associate) => associate.customer.obj?.email === email,
    );
  }


  @Reactionary({
    inputSchema: EmployeeQueryListSchema,
    outputSchema: EmployeePaginatedListSchema,
  })
  public override async listEmployees(
    payload: EmployeeQueryList,
  ): Promise<Result<EmployeePaginatedList>> {


    const businessUnit = await this.getBusinessUnit(payload.search.organization.taxIdentifier);
    if (!businessUnit) {
      return success(
        this.factory.parseEmployeePaginatedList(
          this.context,
          {
            items: [],
            totalCount: 0,
          },
          payload
        ),
      );
    }

    const employees = businessUnit.associates
      .filter((associate) => {

        const assocEmail = (associate.customer.obj?.email ?? '').toLowerCase();
        const assocFirstName = (associate.customer.obj?.firstName ?? '').toLowerCase();
        const assocLastName = (associate.customer.obj?.lastName ?? '').toLowerCase();
        const assocRole = this.getAssociateRole(associate) ?? '';

        if (payload.search.email && !assocEmail.startsWith(payload.search.email.toLowerCase())) {
          return false;
        }
        if (payload.search.firstName && !assocFirstName.startsWith(payload.search.firstName.toLowerCase())) {
          return false;
        }
        if (payload.search.lastName && !assocLastName.startsWith(payload.search.lastName.toLowerCase())) {
          return false;
        }
        if (payload.search.role && assocRole !== payload.search.role) {
          return false;
        }
        return true;
      });

    const pageNumber = payload.search.paginationOptions.pageNumber;
    const pageSize = payload.search.paginationOptions.pageSize;
    const offset = (pageNumber - 1) * pageSize;
    const paged = employees.slice(offset, offset + pageSize);

    return success(
      this.factory.parseEmployeePaginatedList(
        this.context,
        {
          items: paged,
          totalCount: employees.length,
        },
        payload
      )
    );
  }

  @Reactionary({
    inputSchema: EmployeeQueryByEmailSchema,
    outputSchema: EmployeeSchema,
  })
  public override async getByEmail(
    payload: EmployeeQueryByEmail,
  ): Promise<Result<Employee>> {
    const businessUnit = await this.getBusinessUnit(payload.organization.taxIdentifier);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.organization,
      });
    }

    const customer = await this.findAssociateByEmail(businessUnit, payload.email);
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: { email: payload.email },
      });
    }

    return success(this.factory.parseEmployee(this.context, {
      organization: payload.organization,
      associate: customer,
    }));
  }

  protected assignRolePayload(
    payload: EmployeeMutationAssignRole,
  ): MyBusinessUnitUpdateAction[] {
    const nextRoles = Array.from(new Set([this.factory.mapRole(payload.role)]));

    return [
      {
        action: 'changeAssociate',
        associate: {
          customer: {
            typeId: 'customer',
            id: payload.employeeIdentifier.userId,
          },
          associateRoleAssignments: nextRoles.map((roleKey) => ({
            associateRole: {
              typeId: 'associate-role',
              key: roleKey,
            },
          })),
        },
      },
    ];
  }

  @Reactionary({
    inputSchema: EmployeeMutationAssignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public override async assignRole(
    payload: EmployeeMutationAssignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const associate = this.findAssociateByCustomerId(
      businessUnit,
      payload.employeeIdentifier.userId,
    );
    if (!associate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    const actions = this.assignRolePayload(payload);
    const updated = await this.updateBusinessUnit(key, businessUnit.version, actions);

    const updatedAssociate = this.findAssociateByCustomerId(
      updated,
      payload.employeeIdentifier.userId,
    );
    if (!updatedAssociate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    const customersById = this.findAssociateByCustomerId(updated, payload.employeeIdentifier.userId);
    if (!customersById) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    return success(this.factory.parseEmployee(this.context, { organization: payload.company, associate: customersById }));
  }

  /**
   * The CT role assigned when you have no other roles in the org
   * @returns
   */
  protected getDefaultRole(): string {
    return 'buyer';
  }

  protected unassignRolePayload(
    payload: EmployeeMutationUnassignRole,
    associate: Associate,
  ): MyBusinessUnitUpdateAction[] {

    const ctRole = this.factory.mapRole(payload.role);
    const nextRoles = this.getRoles(associate).filter((role) => role !== ctRole);
    if (nextRoles.length === 0) {
      nextRoles.push(this.getDefaultRole());
    }
    return [
      {
        action: 'changeAssociate',
        associate: {
          customer: {
            typeId: 'customer',
            id: payload.employeeIdentifier.userId,
          },
          associateRoleAssignments: nextRoles.map((roleKey) => ({
            associateRole: {
              typeId: 'associate-role',
              key: roleKey,
            },
          })),
        },
      },
    ];
  }

  @Reactionary({
    inputSchema: EmployeeMutationUnassignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public override async unassignRole(
    payload: EmployeeMutationUnassignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const associate = this.findAssociateByCustomerId(
      businessUnit,
      payload.employeeIdentifier.userId,
    );
    if (!associate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    const actions = this.unassignRolePayload(payload, associate);
    const updated = await this.updateBusinessUnit(key, businessUnit.version, actions);

    const updatedAssociate = this.findAssociateByCustomerId(
      updated,
      payload.employeeIdentifier.userId,
    );
    if (!updatedAssociate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    return success(this.factory.parseEmployee(this.context, { organization: payload.company, associate: updatedAssociate }));
  }


  protected removeEmployeePayload(
    payload: EmployeeMutationRemoveEmployee,
  ): MyBusinessUnitUpdateAction[] {
    return [
      {
        action: 'removeAssociate',
        customer: {
          typeId: 'customer',
          id: payload.employeeIdentifier.userId,
        },
      },
    ];
  }

  public override async removeEmployee(
    payload: EmployeeMutationRemoveEmployee,
  ): Promise<Result<void, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const associate = this.findAssociateByCustomerId(
      businessUnit,
      payload.employeeIdentifier.userId,
    );
    if (!associate) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.employeeIdentifier,
      });
    }

    const actions = this.removeEmployeePayload(payload);
    await this.updateBusinessUnit(key, businessUnit.version, actions);

    return success(undefined);
  }
}
