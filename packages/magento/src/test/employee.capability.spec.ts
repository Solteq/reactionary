import {
  EmployeePaginatedListSchema,
  EmployeeSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MagentoEmployeeCapability } from '../capabilities/employee.capability.js';
import type { MagentoClient } from '../core/client.js';
import type { MagentoCompanyRoleMapping } from '../factories/employee/employee-role.js';
import { MagentoEmployeeFactory } from '../factories/employee/employee.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const roleMapping: MagentoCompanyRoleMapping = { manager: 'Buyer Manager', employee: 'Ma==' };

const config: MagentoConfiguration = {
  adminApiKey: 'admin-secret',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
  companyRoleMapping: roleMapping,
};

const COMPANY = {
  id: 'Mw==',
  name: 'Acme',
  email: 'office@acme.test',
  vat_tax_id: 'DK12345678',
  company_admin: { id: 'Mg==', email: 'boss@acme.test' },
};

const ADMIN = {
  id: 'Mg==',
  email: 'boss@acme.test',
  firstname: 'Bo',
  lastname: 'Boss',
  status: 'ACTIVE',
  role: { id: 'MA==', name: 'Company Administrator' },
};
const MANAGER = {
  id: 'NQ==',
  email: 'mia@acme.test',
  firstname: 'Mia',
  lastname: 'Manager',
  status: 'ACTIVE',
  role: { id: 'MTE=', name: 'Buyer Manager' },
};
const EMPLOYEE = {
  id: 'Ng==',
  email: 'eve@acme.test',
  firstname: 'Eve',
  lastname: 'Employee',
  status: 'ACTIVE',
  role: { id: 'Ma==', name: 'Default User' },
};
const ROLES = [
  { id: 'Ma==', name: 'Default User' },
  { id: 'MTE=', name: 'Buyer Manager' },
];

const ACME = { taxIdentifier: 'DK12345678' };

function operationName(document: string): string {
  return /(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? '';
}

type GraphqlHandler = (variables?: Record<string, unknown>) => unknown;

function createMagentoApi(handlers: Record<string, GraphqlHandler>) {
  return {
    graphqlRequest: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      const handler = handlers[operationName(document)];
      if (!handler) {
        throw new Error(`Unexpected GraphQL operation ${operationName(document)}`);
      }
      return handler(variables);
    }),
    getCustomerId: vi.fn().mockResolvedValue(null),
    getMe: vi.fn(),
  };
}

function usersPage(users: unknown[]) {
  return () => ({ company: { ...COMPANY, users: { items: users, total_count: users.length } } });
}

function userById(users: Array<{ id: string }>) {
  return (variables?: Record<string, unknown>) => ({
    company: { ...COMPANY, user: users.find((u) => u.id === variables?.['id']) ?? null },
  });
}

function findCall(api: ReturnType<typeof createMagentoApi>, name: string) {
  return api.graphqlRequest.mock.calls.find(([document]) => operationName(document) === name);
}

describe('MagentoEmployeeCapability', () => {
  const context = createInitialRequestContext();

  function createCapability(handlers: Record<string, GraphqlHandler>, mapping = roleMapping) {
    const magentoApi = createMagentoApi(handlers);
    const capability = new MagentoEmployeeCapability(
      { ...config, companyRoleMapping: mapping },
      new NoOpCache(),
      context,
      magentoApi as unknown as MagentoClient,
      new MagentoEmployeeFactory(EmployeeSchema, EmployeePaginatedListSchema, mapping),
    );
    return { capability, magentoApi };
  }

  it('lists active users with their core roles and numeric ids', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUsers: usersPage([ADMIN, MANAGER, EMPLOYEE]),
    });

    const result = await capability.listEmployees({
      search: { company: ACME, paginationOptions: { pageNumber: 1, pageSize: 20 } },
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.totalCount).toBe(3);
    expect(result.value.items.map((e) => [e.identifier.userId, e.email, e.role])).toEqual([
      ['2', 'boss@acme.test', 'admin'],
      ['5', 'mia@acme.test', 'manager'],
      ['6', 'eve@acme.test', 'employee'],
    ]);
    expect(result.value.items[0]?.company).toEqual({ taxIdentifier: 'DK12345678', key: 'Mw==' });
    expect(findCall(magentoApi, 'ReactionaryCompanyUsers')?.[1]).toEqual({
      pageSize: 20,
      currentPage: 1,
      status: 'ACTIVE',
    });
  });

  it('filters by role client-side', async () => {
    const { capability } = createCapability({
      ReactionaryCompanyUsers: usersPage([ADMIN, MANAGER, EMPLOYEE]),
    });

    const result = await capability.listEmployees({
      search: {
        company: ACME,
        role: 'manager',
        paginationOptions: { pageNumber: 1, pageSize: 20 },
      },
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.totalCount).toBe(1);
    expect(result.value.items[0]?.email).toBe('mia@acme.test');
  });

  it('returns NotFound for another company', async () => {
    const { capability } = createCapability({
      ReactionaryCompanyUsers: usersPage([ADMIN]),
    });

    const result = await capability.listEmployees({
      search: { company: { taxIdentifier: 'SE1' }, paginationOptions: { pageNumber: 1, pageSize: 20 } },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('NotFound');
  });

  it('finds an employee by email, case-insensitively', async () => {
    const { capability } = createCapability({
      ReactionaryCompanyUsers: usersPage([ADMIN, EMPLOYEE]),
    });

    const found = await capability.getByEmail({ company: ACME, email: 'EVE@acme.test' });
    const missing = await capability.getByEmail({ company: ACME, email: 'nobody@acme.test' });

    if (!found.success) throw new Error(JSON.stringify(found.error));
    expect(found.value.firstName).toBe('Eve');
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.type).toBe('NotFound');
  });

  it('assigns the mapped Magento role by uid', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([EMPLOYEE]),
      ReactionaryCompanyRoles: () => ({ company: { id: 'Mw==', roles: { items: ROLES } } }),
      ReactionaryUpdateCompanyUser: () => ({
        updateCompanyUser: { user: { ...EMPLOYEE, role: { id: 'MTE=', name: 'Buyer Manager' } } },
      }),
    });

    const result = await capability.assignRole({
      company: ACME,
      employeeIdentifier: { userId: '6' },
      role: 'manager',
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.role).toBe('manager');
    expect(findCall(magentoApi, 'ReactionaryCompanyUser')?.[1]).toEqual({ id: 'Ng==' });
    expect(findCall(magentoApi, 'ReactionaryUpdateCompanyUser')?.[1]).toEqual({
      input: { id: 'Ng==', role_id: 'MTE=' },
    });
  });

  it('requires a role mapping to assign a role', async () => {
    const { capability } = createCapability(
      { ReactionaryCompanyUser: userById([EMPLOYEE]) },
      {},
    );

    const result = await capability.assignRole({
      company: ACME,
      employeeIdentifier: { userId: '6' },
      role: 'manager',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('InvalidInput');
  });

  it('refuses to assign the admin role or touch the administrator', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([ADMIN]),
    });

    const admin = await capability.assignRole({
      company: ACME,
      employeeIdentifier: { userId: '6' },
      role: 'admin',
    });
    const ofAdmin = await capability.assignRole({
      company: ACME,
      employeeIdentifier: { userId: '2' },
      role: 'employee',
    });

    for (const result of [admin, ofAdmin]) {
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('InvalidInput');
    }
    expect(findCall(magentoApi, 'ReactionaryUpdateCompanyUser')).toBeUndefined();
  });

  it('unassigning manager moves the user to the employee role', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([MANAGER]),
      ReactionaryCompanyRoles: () => ({ company: { id: 'Mw==', roles: { items: ROLES } } }),
      ReactionaryUpdateCompanyUser: () => ({
        updateCompanyUser: { user: { ...MANAGER, role: ROLES[0] } },
      }),
    });

    const result = await capability.unassignRole({
      company: ACME,
      employeeIdentifier: { userId: '5' },
      role: 'manager',
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.role).toBe('employee');
    expect(findCall(magentoApi, 'ReactionaryUpdateCompanyUser')?.[1]).toEqual({
      input: { id: 'NQ==', role_id: 'Ma==' },
    });
  });

  it('unassigning a role the user does not hold changes nothing', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([EMPLOYEE]),
    });

    const result = await capability.unassignRole({
      company: ACME,
      employeeIdentifier: { userId: '6' },
      role: 'manager',
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.role).toBe('employee');
    expect(findCall(magentoApi, 'ReactionaryUpdateCompanyUser')).toBeUndefined();
  });

  it('removes a company user with deleteCompanyUserV2', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([EMPLOYEE]),
      ReactionaryDeleteCompanyUser: () => ({ deleteCompanyUserV2: { success: true } }),
    });

    const result = await capability.removeEmployee({
      company: ACME,
      employeeIdentifier: { userId: '6' },
    });

    expect(result.success).toBe(true);
    expect(findCall(magentoApi, 'ReactionaryDeleteCompanyUser')?.[1]).toEqual({ id: 'Ng==' });
  });

  it('returns NotFound when removing an unknown user', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCompanyUser: userById([]),
    });

    const result = await capability.removeEmployee({
      company: ACME,
      employeeIdentifier: { userId: '99' },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('NotFound');
    expect(findCall(magentoApi, 'ReactionaryDeleteCompanyUser')).toBeUndefined();
  });
});
