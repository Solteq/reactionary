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
  type EmployeeRole,
  EmployeeSchema,
  type Fail,
  type IdentityIdentifier,
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
  encodeMagentoUid,
  MagentoCompanyApi,
  NOT_A_COMPANY_USER_MESSAGE,
} from '../core/company.api.js';
import {
  matchesMagentoCompany,
  toMagentoCompanyIdentifier,
} from '../factories/company/company.factory.js';
import {
  findMagentoCompanyRole,
  isMagentoCompanyAdmin,
} from '../factories/employee/employee-role.js';
import type {
  MagentoEmployeeFactory,
  MagentoEmployeeInput,
} from '../factories/employee/employee.factory.js';
import type { MagentoCompany, MagentoCompanyUser } from '../schema/company.types.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:employee');

/** Page size used when every company user has to be scanned client-side. */
const SCAN_PAGE_SIZE = 100;

/** A company user loaded for a mutation, with the company it belongs to. */
interface LoadedCompanyUser {
  company: MagentoCompany;
  user: MagentoCompanyUser & { id: string };
}

/**
 * Adobe Commerce B2B company users, managed through the storefront GraphQL
 * API as the signed-in company user (who needs the matching company ACL
 * permissions, e.g. `Magento_Company::users_edit`).
 *
 * - Only the signed-in customer's own company is reachable; any other company
 *   identifier is `NotFound`.
 * - Only active users are listed. Magento cannot filter users by email, name
 *   or role, so a filtered search scans every page client-side.
 * - Roles: the company administrator is `admin`; other users map through
 *   `companyRoleMapping`. Magento users hold exactly one role and the
 *   administrator cannot be (re)assigned through the storefront API.
 * - Magento has no per-user spending limit.
 */
export class MagentoEmployeeCapability<
  TFactory extends EmployeeFactory = MagentoEmployeeFactory,
> extends EmployeeCapability {
  protected config: MagentoConfiguration;
  protected factory: EmployeeFactoryWithOutput<TFactory>;
  protected companyApi: MagentoCompanyApi;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: EmployeeFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.companyApi = new MagentoCompanyApi(magentoApi);
  }

  /** Checks the loaded company against the requested one. */
  protected checkCompany(
    company: MagentoCompany | null,
    identifier: CompanyIdentifier,
  ): Fail<NotFoundError> | null {
    if (!company) {
      return companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
    }
    if (!matchesMagentoCompany(identifier, company)) {
      return companyFailure({ type: 'NotFound', identifier });
    }
    return null;
  }

  protected toEmployeeInput(company: MagentoCompany, user: MagentoCompanyUser): MagentoEmployeeInput {
    return {
      company: toMagentoCompanyIdentifier(company),
      user,
      companyAdmin: company.company_admin,
    };
  }

  /** Every active user of the current company, scanning all pages. */
  protected async scanCompanyUsers(): Promise<{
    company: MagentoCompany | null;
    users: MagentoCompanyUser[];
  }> {
    const users: MagentoCompanyUser[] = [];
    let company: MagentoCompany | null = null;
    for (let currentPage = 1; ; currentPage++) {
      const page = await this.companyApi.getCompanyUsers(SCAN_PAGE_SIZE, currentPage);
      if (!page) {
        return { company: null, users: [] };
      }
      company = page.company;
      users.push(
        ...page.users.items.filter((user): user is MagentoCompanyUser => user !== null),
      );
      if (
        page.users.items.length < SCAN_PAGE_SIZE ||
        currentPage * SCAN_PAGE_SIZE >= page.users.total_count
      ) {
        return { company, users };
      }
    }
  }

  /** Loads a user of the requested company by its numeric customer id. */
  protected async loadCompanyUser(
    companyIdentifier: CompanyIdentifier,
    employeeIdentifier: IdentityIdentifier,
  ): Promise<Result<LoadedCompanyUser, NotFoundError>> {
    const loaded = await this.companyApi.getCompanyUser(
      encodeMagentoUid(employeeIdentifier.userId),
    );
    const failure = this.checkCompany(loaded?.company ?? null, companyIdentifier);
    if (failure) {
      return failure;
    }
    const user = loaded?.user;
    if (!loaded || !user || !user.id) {
      return companyFailure({ type: 'NotFound', identifier: employeeIdentifier });
    }
    return success({ company: loaded.company, user: { ...user, id: user.id } });
  }

  /** Moves a (non-administrator) user onto the Magento role mapped to `role`. */
  protected async setRole(
    loaded: LoadedCompanyUser,
    role: EmployeeRole,
  ): Promise<Result<Employee, NotFoundError>> {
    const reference = this.factory.mapRole(role);
    if (!reference) {
      return companyFailure({
        type: 'InvalidInput',
        error: `No Magento company role is configured for "${role}" (set companyRoleMapping.${role})`,
      });
    }

    const roles = await this.companyApi.getCompanyRoles();
    const target = roles ? findMagentoCompanyRole(roles, reference) : undefined;
    if (!target) {
      return companyFailure({
        type: 'InvalidInput',
        error: `The company has no Magento role "${reference}" (companyRoleMapping.${role})`,
      });
    }

    const updated = await this.companyApi.updateCompanyUser({
      id: loaded.user.id,
      role_id: target.id,
    });
    if (!updated) {
      return companyFailure({
        type: 'Generic',
        message: 'Failed to update the company user role: Magento returned no user',
      });
    }

    return success(
      this.factory.parseEmployee(this.context, this.toEmployeeInput(loaded.company, updated)),
    );
  }

  protected adminRoleFailure(): Fail<NotFoundError> {
    return companyFailure({
      type: 'InvalidInput',
      error: 'The company administrator cannot be assigned, unassigned or removed through the Magento storefront API',
    });
  }

  @Reactionary({
    inputSchema: EmployeeQueryListSchema,
    outputSchema: EmployeePaginatedListSchema,
  })
  public async listEmployees(payload: EmployeeQueryList): Promise<Result<EmployeePaginatedList>> {
    debug('listEmployees %o', payload.search.paginationOptions);
    const { company: companyIdentifier, email, firstName, lastName, role, paginationOptions } =
      payload.search;
    const { pageNumber, pageSize } = paginationOptions;

    try {
      if (!email && !firstName && !lastName && !role) {
        const page = await this.companyApi.getCompanyUsers(pageSize, pageNumber);
        const failure = this.checkCompany(page?.company ?? null, companyIdentifier);
        if (failure || !page) {
          return failure ?? companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
        }
        const items = page.users.items
          .filter((user): user is MagentoCompanyUser => user !== null)
          .map((user) => this.toEmployeeInput(page.company, user));
        return success(
          this.factory.parseEmployeePaginatedList(
            this.context,
            { items, totalCount: page.users.total_count },
            payload,
          ),
        );
      }

      const { company, users } = await this.scanCompanyUsers();
      const failure = this.checkCompany(company, companyIdentifier);
      if (failure || !company) {
        return failure ?? companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
      }

      const contains = (value: string | null | undefined, needle: string | undefined) =>
        !needle || (value ?? '').toLowerCase().includes(needle.toLowerCase());
      const matches = users
        .map((user) => this.toEmployeeInput(company, user))
        .filter(
          (input) =>
            (!email || (input.user.email ?? '').toLowerCase() === email.toLowerCase()) &&
            contains(input.user.firstname, firstName) &&
            contains(input.user.lastname, lastName) &&
            (!role || this.factory.parseEmployee(this.context, input).role === role),
        );

      const start = (pageNumber - 1) * pageSize;
      return success(
        this.factory.parseEmployeePaginatedList(
          this.context,
          { items: matches.slice(start, start + pageSize), totalCount: matches.length },
          payload,
        ),
      );
    } catch (err) {
      return handleMagentoProviderError('list employees', err, companyIdentifier);
    }
  }

  @Reactionary({
    inputSchema: EmployeeQueryByEmailSchema,
    outputSchema: EmployeeSchema,
  })
  public async getByEmail(payload: EmployeeQueryByEmail): Promise<Result<Employee>> {
    debug('getByEmail');
    try {
      const { company, users } = await this.scanCompanyUsers();
      const failure = this.checkCompany(company, payload.company);
      if (failure || !company) {
        return failure ?? companyFailure({ type: 'Generic', message: NOT_A_COMPANY_USER_MESSAGE });
      }
      const email = payload.email.toLowerCase();
      const user = users.find((candidate) => (candidate.email ?? '').toLowerCase() === email);
      if (!user) {
        return companyFailure({
          type: 'NotFound',
          identifier: { company: payload.company, email: payload.email },
        });
      }
      return success(this.factory.parseEmployee(this.context, this.toEmployeeInput(company, user)));
    } catch (err) {
      return handleMagentoProviderError('get employee by email', err, payload.company);
    }
  }

  @Reactionary({
    inputSchema: EmployeeMutationAssignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public async assignRole(
    payload: EmployeeMutationAssignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    debug('assignRole %s -> %s', payload.employeeIdentifier.userId, payload.role);
    if (payload.role === 'admin') {
      return this.adminRoleFailure();
    }
    try {
      const loaded = await this.loadCompanyUser(payload.company, payload.employeeIdentifier);
      if (!loaded.success) {
        return loaded;
      }
      if (isMagentoCompanyAdmin(loaded.value.user, loaded.value.company.company_admin)) {
        return this.adminRoleFailure();
      }
      return await this.setRole(loaded.value, payload.role);
    } catch (err) {
      return handleMagentoProviderError('assign employee role', err, payload.employeeIdentifier);
    }
  }

  /**
   * Magento users hold exactly one role, so unassigning `manager` moves the
   * user back to the `employee` role; unassigning a role the user does not
   * hold changes nothing; the base `employee` role cannot be unassigned.
   */
  @Reactionary({
    inputSchema: EmployeeMutationUnassignRoleSchema,
    outputSchema: EmployeeSchema,
  })
  public async unassignRole(
    payload: EmployeeMutationUnassignRole,
  ): Promise<Result<Employee, NotFoundError>> {
    debug('unassignRole %s -x %s', payload.employeeIdentifier.userId, payload.role);
    if (payload.role === 'admin') {
      return this.adminRoleFailure();
    }
    try {
      const loaded = await this.loadCompanyUser(payload.company, payload.employeeIdentifier);
      if (!loaded.success) {
        return loaded;
      }
      const { company, user } = loaded.value;
      if (isMagentoCompanyAdmin(user, company.company_admin)) {
        return this.adminRoleFailure();
      }
      const current = this.factory.parseEmployee(this.context, this.toEmployeeInput(company, user));
      if (current.role !== payload.role) {
        return success(current);
      }
      if (payload.role === 'employee') {
        return companyFailure({
          type: 'InvalidInput',
          error: 'Every Magento company user holds a role; assign a different role instead of unassigning "employee"',
        });
      }
      return await this.setRole(loaded.value, 'employee');
    } catch (err) {
      return handleMagentoProviderError('unassign employee role', err, payload.employeeIdentifier);
    }
  }

  @Reactionary({
    inputSchema: EmployeeMutationRemoveEmployeeSchema,
  })
  public async removeEmployee(
    payload: EmployeeMutationRemoveEmployee,
  ): Promise<Result<void, NotFoundError>> {
    debug('removeEmployee %s', payload.employeeIdentifier.userId);
    try {
      const loaded = await this.loadCompanyUser(payload.company, payload.employeeIdentifier);
      if (!loaded.success) {
        return loaded;
      }
      if (isMagentoCompanyAdmin(loaded.value.user, loaded.value.company.company_admin)) {
        return this.adminRoleFailure();
      }
      const removed = await this.companyApi.deleteCompanyUser(loaded.value.user.id);
      if (!removed) {
        return companyFailure({
          type: 'Generic',
          message: 'Failed to remove employee: Magento reported the company user as not deleted',
        });
      }
      return success(undefined);
    } catch (err) {
      return handleMagentoProviderError('remove employee', err, payload.employeeIdentifier);
    }
  }
}
