import { FetchError } from '@medusajs/js-sdk';
import {
  type Cache,
  type CompanyIdentifier,
  type Employee,
  EmployeeCapability,
  type EmployeeFactory,
  type EmployeeFactoryWithOutput,
  type EmployeeMutationAssignRole,
  EmployeeMutationAssignRoleSchema,
  type EmployeeMutationRemoveEmployee,
  EmployeeMutationRemoveEmployeeSchema,
  type EmployeeMutationUnassignRole,
  EmployeeMutationUnassignRoleSchema,
  type EmployeePaginatedList,
  EmployeePaginatedListSchema,
  type EmployeeQueryByEmail,
  EmployeeQueryByEmailSchema,
  type EmployeeQueryList,
  EmployeeQueryListSchema,
  EmployeeSchema,
  type IdentityIdentifier,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type {
  MedusaEmployeeFactory,
  MedusaRawEmployee,
} from '../factories/employee/employee.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { handleProviderError } from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:employee');

const EMPLOYEE_FIELDS = ['*', 'customer.*'].join(',');

export class MedusaEmployeeCapability<
  TFactory extends EmployeeFactory = MedusaEmployeeFactory,
> extends EmployeeCapability {
  protected config: MedusaConfiguration;
  protected factory: EmployeeFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: EmployeeFactoryWithOutput<TFactory>,
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

  /**
   * ponytail: there's no `customer_id` filter on the backend's employee list route, so resolving an
   * employee by customer id means scanning the company's employee list client-side. Upgrade path: ask
   * the backend to add a `customer_id` filter to `StoreGetEmployeeParams`.
   */
  protected async fetchCompanyEmployees(
    companyId: string,
    opts: { email?: string } = {},
  ): Promise<{ employees: MedusaRawEmployee[]; count: number }> {
    const client = await this.medusaApi.getClient();
    const response = await client.client.fetch<{
      employees: MedusaRawEmployee[];
      count: number;
    }>(`/store/companies/${companyId}/employees`, {
      method: 'GET',
      query: {
        fields: EMPLOYEE_FIELDS,
        email: opts.email,
        limit: 1000,
      },
    });
    // ponytail: the backend's list route returns metadata.count only for its email/q-filtered branches -
    // the plain (unfiltered) branch queries employees as a nested relation and never sets it, so `count`
    // comes back undefined there. Fall back to the actual array length.
    return { employees: response.employees, count: response.count ?? response.employees.length };
  }

  protected async findEmployeeByCustomerId(
    companyId: string,
    customerId: string,
  ): Promise<MedusaRawEmployee | undefined> {
    const { employees } = await this.fetchCompanyEmployees(companyId);
    return employees.find((employee) => employee.customer?.id === customerId);
  }

  @Reactionary({
    inputSchema: EmployeeQueryListSchema,
    outputSchema: EmployeePaginatedListSchema,
  })
  public async listEmployees(
    payload: EmployeeQueryList,
  ): Promise<Result<EmployeePaginatedList>> {
    debug('listEmployees', payload);
    try {
      const companyId = await this.resolveCompanyId(payload.search.company.taxIdentifier);
      if (!companyId) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.search.company });
      }

      const { employees, count } = await this.fetchCompanyEmployees(companyId, {
        email: payload.search.email,
      });

      const { pageNumber, pageSize } = payload.search.paginationOptions;
      const start = (pageNumber - 1) * pageSize;
      const page = employees.slice(start, start + pageSize).map((employee) => ({
        company: payload.search.company,
        employee,
      }));

      return success(
        this.factory.parseEmployeePaginatedList(
          this.context,
          { items: page, totalCount: count },
          payload,
        ),
      );
    } catch (err) {
      handleProviderError('list employees', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeQueryByEmailSchema,
    outputSchema: EmployeeSchema,
  })
  public async getByEmail(payload: EmployeeQueryByEmail): Promise<Result<Employee>> {
    debug('getByEmail', payload);
    try {
      const companyId = await this.resolveCompanyId(payload.company.taxIdentifier);
      if (!companyId) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }

      const { employees } = await this.fetchCompanyEmployees(companyId, { email: payload.email });
      const employee = employees[0];
      if (!employee) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload });
      }

      return success(
        this.factory.parseEmployee(this.context, { company: payload.company, employee }),
      );
    } catch (err) {
      handleProviderError('get employee by email', err);
    }
  }

  protected async updateEmployeeRole(
    company: CompanyIdentifier,
    employeeIdentifier: IdentityIdentifier,
    role: string,
  ): Promise<Result<Employee, NotFoundError>> {
    const companyId = await this.resolveCompanyId(company.taxIdentifier);
    if (!companyId) {
      return error<NotFoundError>({ type: 'NotFound', identifier: company });
    }

    const existing = await this.findEmployeeByCustomerId(companyId, employeeIdentifier.userId);
    if (!existing) {
      return error<NotFoundError>({ type: 'NotFound', identifier: employeeIdentifier });
    }

    const client = await this.medusaApi.getClient();
    const response = await client.client.fetch<{ employee: MedusaRawEmployee }>(
      `/store/companies/${companyId}/employees/${existing.id}`,
      {
        method: 'POST',
        body: { role },
        query: { fields: EMPLOYEE_FIELDS },
      },
    );

    return success(
      this.factory.parseEmployee(this.context, {
        company,
        employee: response.employee,
      }),
    );
  }

  @Reactionary({
    inputSchema: EmployeeMutationAssignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public async assignRole(
    payload: EmployeeMutationAssignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    debug('assignRole', payload);
    try {
      return await this.updateEmployeeRole(
        payload.company,
        payload.employeeIdentifier,
        this.factory.mapRole(payload.role),
      );
    } catch (err) {
      handleProviderError('assign employee role', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeMutationUnassignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public async unassignRole(
    payload: EmployeeMutationUnassignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    debug('unassignRole', payload);
    try {
      // role is a single tier (employee/manager/admin), not a set of independent flags, so "unassigning"
      // any of them just reverts the employee to the base tier.
      return await this.updateEmployeeRole(
        payload.company,
        payload.employeeIdentifier,
        'employee',
      );
    } catch (err) {
      handleProviderError('unassign employee role', err);
    }
  }

  @Reactionary({
    inputSchema: EmployeeMutationRemoveEmployeeSchema,
  })
  public async removeEmployee(
    payload: EmployeeMutationRemoveEmployee,
  ): Promise<Result<void, NotFoundError>> {
    debug('removeEmployee', payload);
    try {
      const companyId = await this.resolveCompanyId(payload.company.taxIdentifier);
      if (!companyId) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.company });
      }

      const existing = await this.findEmployeeByCustomerId(
        companyId,
        payload.employeeIdentifier.userId,
      );
      if (!existing) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.employeeIdentifier,
        });
      }

      const client = await this.medusaApi.getClient();
      await client.client.fetch(`/store/companies/${companyId}/employees/${existing.id}`, {
        method: 'DELETE',
      });

      return success(undefined);
    } catch (err) {
      handleProviderError('remove employee', err);
    }
  }
}
