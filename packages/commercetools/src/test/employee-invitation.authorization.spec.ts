import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercetoolsEmployeeInvitationCapability } from '../capabilities/employee-invitation.capability.js';
import { CommercetoolsAPI } from '../core/client.js';
import {
  COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS,
  COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX,
  CommercetoolsEmployeeInvitationFactory,
} from '../factories/employee-invitation/employee-invitation.factory.js';
import { CommercetoolsConfigurationSchema } from '../schema/configuration.schema.js';

const API_URL = 'https://api.test';
const PROJECT = 'test-project';

const ACME = { taxIdentifier: 'ACME' };
const GLOBEX = { taxIdentifier: 'GLOBEX' };

type FakeAssociate = { customerId: string; roles: string[] };
type FakeBusinessUnit = { key: string; version: number; associates: FakeAssociate[] };
type FakeCustomObject = { container: string; key: string; value: Record<string, unknown>; version: number };

/** Just enough of the commercetools HTTP API for the invitation capability, kept in memory. */
class FakeCommercetools {
  customers = new Map<string, string>();
  businessUnits: FakeBusinessUnit[] = [];
  customObjects = new Map<string, FakeCustomObject>();
  customObjectWrites = 0;

  addCustomer(id: string, email: string) {
    this.customers.set(id, email);
  }

  addBusinessUnit(key: string, associates: FakeAssociate[]) {
    this.businessUnits.push({ key, version: 1, associates });
  }

  /** Stores an invitation and indexes it the way the capability does. */
  seedInvitation(key: string, company: { taxIdentifier: string }, email: string) {
    this.putCustomObject(COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS, key, {
      tokenHash: 'hash',
      businessUnitKey: company.taxIdentifier,
      status: 'invited',
      email,
      role: 'employee',
      company,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      invitedBy: 'someone',
      invitedDate: new Date().toISOString(),
      lastUpdatedBy: 'someone',
      lastUpdatedDate: new Date().toISOString(),
    });
    for (const indexKey of [
      'org-' + Buffer.from(company.taxIdentifier).toString('base64'),
      'email-' + Buffer.from(email).toString('base64').replace(/=+$/, ''),
    ]) {
      const existing = this.customObjects.get(this.objectId(COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX, indexKey));
      const ids = existing && Array.isArray(existing.value['invitationIds']) ? existing.value['invitationIds'] : [];
      this.putCustomObject(COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS_INDEX, indexKey, {
        invitationIds: [...ids, key],
      });
    }
  }

  invitationStatus(key: string): unknown {
    return this.customObjects.get(this.objectId(COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS, key))?.value['status'];
  }

  invitationCount(): number {
    return [...this.customObjects.values()].filter(
      (object) => object.container === COMMERCERTOOLS_CUSTOM_OBJECT_CONTAINER_EMPLOYEE_INVITATIONS,
    ).length;
  }

  protected objectId(container: string, key: string) {
    return `${container}/${key}`;
  }

  protected putCustomObject(container: string, key: string, value: Record<string, unknown>): FakeCustomObject {
    const object = { container, key, value, version: 1 };
    this.customObjects.set(this.objectId(container, key), object);
    return object;
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const notFound = () => json({ statusCode: 404, message: 'not found' }, 404);
    const path = url.pathname.replace(`/${PROJECT}`, '');

    const businessUnitRoute = /^\/as-associate\/([^/]+)\/business-units\/key=([^/]+)$/.exec(path);
    if (request.method === 'GET' && businessUnitRoute) {
      const [, associateId, key] = businessUnitRoute;
      const businessUnit = this.businessUnits.find((candidate) => candidate.key === key);
      // the associate endpoint hides companies the associate does not belong to
      if (!businessUnit || !businessUnit.associates.some((associate) => associate.customerId === associateId)) {
        return notFound();
      }
      return json({
        id: `bu-${businessUnit.key}`,
        key: businessUnit.key,
        version: businessUnit.version,
        associates: businessUnit.associates.map((associate) => ({
          customer: { typeId: 'customer', id: associate.customerId, obj: { id: associate.customerId, email: this.customers.get(associate.customerId) } },
          associateRoleAssignments: associate.roles.map((role) => ({ associateRole: { typeId: 'associate-role', key: role } })),
        })),
      });
    }

    const customerRoute = /^\/customers\/([^/]+)$/.exec(path);
    if (request.method === 'GET' && customerRoute) {
      const email = this.customers.get(customerRoute[1] ?? '');
      return email ? json({ id: customerRoute[1], email }) : notFound();
    }

    if (request.method === 'POST' && path === '/custom-objects') {
      const body = (await request.json()) as { container: string; key: string; value: Record<string, unknown> };
      this.customObjectWrites += 1;
      return json(this.putCustomObject(body.container, body.key, body.value));
    }

    const customObjectRoute = /^\/custom-objects\/([^/]+)\/([^/]+)$/.exec(path);
    if (request.method === 'GET' && customObjectRoute) {
      const object = this.customObjects.get(this.objectId(decodeURIComponent(customObjectRoute[1] ?? ''), decodeURIComponent(customObjectRoute[2] ?? '')));
      return object ? json(object) : notFound();
    }

    return json({ message: `unexpected ${request.method} ${path}` }, 404);
  }
}

const commercetools = new FakeCommercetools();

function createCapability(context: RequestContext) {
  const config = CommercetoolsConfigurationSchema.parse({
    projectKey: PROJECT,
    authUrl: 'https://auth.test',
    apiUrl: API_URL,
    clientId: 'client',
    clientSecret: 'secret',
  });
  const api = new CommercetoolsAPI(config, context);
  const adminClient = createApiBuilderFromCtpClient(
    new ClientBuilder()
      .withProjectKey(PROJECT)
      .withHttpMiddleware({
        host: API_URL,
        httpClient: (input: string | URL | Request, init?: RequestInit) => commercetools.handle(new Request(input, init)),
      })
      .build(),
  );
  vi.spyOn(api, 'getAdminClient').mockResolvedValue(adminClient);
  return new CommercetoolsEmployeeInvitationCapability(config, new NoOpCache(), context, api, new CommercetoolsEmployeeInvitationFactory());
}

const pagination = { pageNumber: 1, pageSize: 20 };

describe('commercetools employee invitation authorization', () => {
  let context: RequestContext;
  let capability: CommercetoolsEmployeeInvitationCapability;

  function actAs(userId: string) {
    context.session.identityContext.identity = { type: 'Registered', id: { userId } };
  }

  beforeEach(() => {
    commercetools.customers.clear();
    commercetools.businessUnits = [];
    commercetools.customObjects.clear();
    commercetools.customObjectWrites = 0;

    commercetools.addCustomer('acme-admin', 'admin@acme.example.com');
    commercetools.addCustomer('acme-buyer', 'buyer@acme.example.com');
    commercetools.addCustomer('globex-admin', 'admin@globex.example.com');
    commercetools.addCustomer('outsider', 'outsider@example.com');
    commercetools.addCustomer('invitee', 'invitee@example.com');
    commercetools.addBusinessUnit('ACME', [
      { customerId: 'acme-admin', roles: ['buyer-admin'] },
      { customerId: 'acme-buyer', roles: ['buyer'] },
    ]);
    commercetools.addBusinessUnit('GLOBEX', [{ customerId: 'globex-admin', roles: ['buyer-admin'] }]);
    commercetools.seedInvitation('acme-invite', ACME, 'invitee@example.com');
    commercetools.seedInvitation('globex-invite', GLOBEX, 'invitee@example.com');

    context = createInitialRequestContext();
    capability = createCapability(context);
  });

  describe('inviteEmployee', () => {
    const invite = { company: ACME, email: 'new@example.com', role: 'admin' } as const;

    it('lets an admin of the company invite, including as admin', async () => {
      actAs('acme-admin');
      const result = await capability.inviteEmployee(invite);
      assert(result.success);
      expect(result.value).toMatchObject({ email: 'new@example.com', role: 'admin', status: 'invited' });
      expect(commercetools.invitationCount()).toBe(3);
    });

    it('refuses a member of the company who is not an admin', async () => {
      actAs('acme-buyer');
      const result = await capability.inviteEmployee(invite);
      assert(!result.success);
      expect(result.error.type).toBe('Generic');
      expect(commercetools.customObjectWrites).toBe(0);
    });

    it('reports a company the caller does not belong to as not found', async () => {
      actAs('outsider');
      const result = await capability.inviteEmployee(invite);
      assert(!result.success);
      expect(result.error.type).toBe('NotFound');
      expect(commercetools.customObjectWrites).toBe(0);
    });

    it('does not let an admin of another company invite into this one', async () => {
      actAs('globex-admin');
      const result = await capability.inviteEmployee(invite);
      assert(!result.success);
      expect(result.error.type).toBe('NotFound');
      expect(commercetools.customObjectWrites).toBe(0);
    });

    it('refuses callers that are not registered', async () => {
      const result = await capability.inviteEmployee(invite);
      assert(!result.success);
      expect(commercetools.customObjectWrites).toBe(0);
    });
  });

  describe('revokeInvitation', () => {
    it('lets an admin of the invitation company revoke it', async () => {
      actAs('acme-admin');
      const result = await capability.revokeInvitation({ invitationIdentifier: { key: 'acme-invite' } });
      assert(result.success);
      expect(commercetools.invitationStatus('acme-invite')).toBe('revoked');
    });

    it('does not let an admin of another company revoke it, and answers as for an unknown key', async () => {
      actAs('globex-admin');
      const foreign = await capability.revokeInvitation({ invitationIdentifier: { key: 'acme-invite' } });
      const unknown = await capability.revokeInvitation({ invitationIdentifier: { key: 'no-such-invite' } });
      assert(!foreign.success);
      assert(!unknown.success);
      expect(foreign.error).toEqual({ type: 'NotFound', identifier: { key: 'acme-invite' } });
      expect(unknown.error).toEqual({ type: 'NotFound', identifier: { key: 'no-such-invite' } });
      expect(commercetools.invitationStatus('acme-invite')).toBe('invited');
    });

    it('does not let a non-admin member or an outsider revoke it', async () => {
      for (const userId of ['acme-buyer', 'outsider']) {
        actAs(userId);
        const result = await capability.revokeInvitation({ invitationIdentifier: { key: 'acme-invite' } });
        assert(!result.success);
        expect(result.error.type).toBe('NotFound');
      }
      expect(commercetools.invitationStatus('acme-invite')).toBe('invited');
    });
  });

  describe('listInvitations', () => {
    const keysOf = (items: Array<{ identifier: { key: string } }>) => items.map((item) => item.identifier.key);

    it('lets an admin list the invitations of the company', async () => {
      actAs('acme-admin');
      const result = await capability.listInvitations({ search: { company: ACME, paginationOptions: pagination } });
      assert(result.success);
      expect(keysOf(result.value.items)).toEqual(['acme-invite']);
    });

    it('refuses to list a company for a non-admin member or an outsider', async () => {
      actAs('acme-buyer');
      const member = await capability.listInvitations({ search: { company: ACME, paginationOptions: pagination } });
      assert(!member.success);
      expect(member.error.type).toBe('Generic');

      for (const userId of ['outsider', 'globex-admin']) {
        actAs(userId);
        const result = await capability.listInvitations({ search: { company: ACME, paginationOptions: pagination } });
        assert(!result.success);
        expect(result.error.type).toBe('NotFound');
      }
    });

    it('lets an invitee list the invitations sent to their own email, across companies', async () => {
      actAs('invitee');
      const result = await capability.listInvitations({ search: { email: 'invitee@example.com', paginationOptions: pagination } });
      assert(result.success);
      expect(keysOf(result.value.items).sort()).toEqual(['acme-invite', 'globex-invite']);
    });

    it('refuses to list the invitations of another email without admin rights over the company', async () => {
      actAs('outsider');
      const withoutCompany = await capability.listInvitations({ search: { email: 'invitee@example.com', paginationOptions: pagination } });
      assert(!withoutCompany.success);
      const withForeignCompany = await capability.listInvitations({
        search: { email: 'invitee@example.com', company: ACME, paginationOptions: pagination },
      });
      assert(!withForeignCompany.success);
      expect(withForeignCompany.error.type).toBe('NotFound');
    });

    it('limits an admin searching another email to the invitations of their own company', async () => {
      actAs('acme-admin');
      const result = await capability.listInvitations({
        search: { email: 'invitee@example.com', company: ACME, paginationOptions: pagination },
      });
      assert(result.success);
      expect(keysOf(result.value.items)).toEqual(['acme-invite']);
    });

    it('does not let an admin read another company by searching an email', async () => {
      actAs('acme-admin');
      const result = await capability.listInvitations({ search: { email: 'invitee@example.com', paginationOptions: pagination } });
      assert(!result.success);
    });
  });
});
