import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type {
  Company,
  EmployeeIssuedInvitation,
  CompanyIdentifier,
  CompanyRegistrationRequest,
  RegisteredIdentity,
  Result,
  Cache,
  Client,
} from '@reactionary/core';

const testData = {
  requestTemplate: (ts: string) =>  {
      return {
        adminUserEmail:  `unittest-orgadmin+${ts}@example.com`,
        billingAddress: {
          countryCode: 'DK',
          city: 'Copenhagen',
          streetAddress: 'Test Street',
          streetNumber: '1',
          postalCode: '1999',
          firstName: 'Test',
          lastName: 'Org admin',
          identifier: {
            nickName: 'default-billing-address'
          },
          region: ''
        },
        name: `TestOrg AutoApprove ${ts}`,
        taxIdentifier: `TE` + ts,
        pointOfContact: {
          email:  `test-contact+${ts}@example.com`,
          phone: '+4512345678',
        },
        dunsIdentifier: 'DUNS-123456789',
        tinIdentifier: 'TIN-123456789',
      };
  },
  employeeEmail: (ts: string) => `test-employee+${ts}@example.com`,
  wrongEmail: (ts: string) => `test-wrong-employee+${ts}@example.com`,
};

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Employees - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;
    let companyIdentifier: CompanyIdentifier;
    let testOrg: ReturnType<typeof testData.requestTemplate>;
    let adminUsername = '';
    const adminPassword = 'password1235!';

    async function getCurrentUserId(client: Client & { cache: Cache; }) {
      const employee = await client.identity.getSelf({});
      if (!employee.success) {
        assert.fail(JSON.stringify(employee.error));
      }
      if (employee.value.type !== 'Registered') {
        assert.fail('Expected a Registered identity');
      }
      return employee.value.id;
    }


    async function registerUserAndAssert(username: string, password: string): Promise<RegisteredIdentity> {
      const identity = await client.identity.register({
        username,
        password,
      });

      if (!identity.success) {
        assert.fail(JSON.stringify(identity.error));
      }

      if (identity.value.type !== 'Registered') {
        assert.fail('Expected a Registered identity');
      }

        await client.profile.setBillingAddress({
        address: {
          countryCode: 'DK',
          city: 'Copenhagen',
          streetAddress: 'Test Street',
          streetNumber: '1',
          postalCode: '1999',
          firstName: 'Test',
          lastName: 'User ' + username,
          identifier: {
            nickName: 'default-user-billing-address'
          },
          region: ''
        },
        identifier: identity.value.id
      })



      return identity.value;
    }

    async function loginAdmin(): Promise<void> {
      const identity = await client.identity.login({
        username: adminUsername,
        password: adminPassword,
      });

      if (!identity.success) {
        assert.fail(JSON.stringify(identity.error));
      }

      expect(identity.value.type).toBe('Registered');
    }

    async function inviteEmployee(email: string, role: 'admin' | 'manager' | 'employee' = 'manager'): Promise<EmployeeIssuedInvitation> {
      const invite = await client.employeeInvitation.inviteEmployee({
        company: companyIdentifier,
        email,
        role,
      });

      if (!invite.success) {
        assert.fail(JSON.stringify(invite.error));
      }

      return invite.value;
    }

    async function registerAndAcceptInvitation(invite: EmployeeIssuedInvitation, email: string) {
      await client.identity.logout({});
      await registerUserAndAssert(email, adminPassword);

      const accepted = await client.employeeInvitation.acceptInvitation({
        invitationIdentifier: invite.identifier,
        securityToken: invite.securityToken,
        currentUserEmail: email,
      });

      return accepted;
    }

    beforeEach(async () => {
      client = createClient(provider);

      const time = Date.now().toString();
      testOrg = testData.requestTemplate(time);
      expect(testOrg.name.startsWith('TestOrg')).toBe(true);

      adminUsername = `testuser+${time}@example.com`;
      await registerUserAndAssert(adminUsername, adminPassword);

      const orgCreateResponse = await client.companyRegistration.requestRegistration(testOrg);
      if (!orgCreateResponse.success) {
        assert.fail(JSON.stringify(orgCreateResponse.error));
      }
      expect(orgCreateResponse.value.status).toBe('pending');

      let checkStatusResult: Result<CompanyRegistrationRequest> | null = null;

      for(let cnt = 0; cnt < 20; cnt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        checkStatusResult = await client.companyRegistration.checkRequestStatus({
          requestIdentifier: orgCreateResponse.value.identifier,
        });

        if (!checkStatusResult.success) {
          assert.fail(JSON.stringify(checkStatusResult.error));
        }
        if (checkStatusResult.value.status === 'approved') {
          break;
        }

        if (cnt === 19) {
          assert.fail('Registration request was not approved within expected time');
        }
      }

      companyIdentifier = orgCreateResponse.value.companyIdentifier;

      const orgResponse = await client.company.getById({
        identifier: companyIdentifier,
      });
      if (!orgResponse.success) {
        assert.fail(JSON.stringify(orgResponse.error));
      }
    }, 15000);

    describe('Roles', () => {
      it('allows admin to assign a role to an employee', async () => {
        const inviteeEmail = testData.employeeEmail(Date.now().toString());
        const invite = await inviteEmployee(inviteeEmail, 'employee');

        const accepted = await registerAndAcceptInvitation(invite, inviteeEmail);
        if (!accepted.success) {
          assert.fail(JSON.stringify(accepted.error));
        }
        const employeeId = await getCurrentUserId(client);

        await client.identity.logout({});
        await loginAdmin();
        const assigned = await client.employee.assignRole({
          company: companyIdentifier,
          employeeIdentifier: employeeId,
          role: 'manager',
        });

        if (!assigned.success) {
          assert.fail(JSON.stringify(assigned.error));
        }

        expect(assigned.value.role).toBe('manager');
        expect(assigned.value.firstName).toBeDefined();
        expect(assigned.value.lastName).toBeDefined();
      }, 20000);

      it('allows admin to unassign a role from an employee', async () => {
        const inviteeEmail = testData.employeeEmail(Date.now().toString());
        const invite = await inviteEmployee(inviteeEmail, 'admin');

        const accepted = await registerAndAcceptInvitation(invite, inviteeEmail);
        if (!accepted.success) {
          assert.fail(JSON.stringify(accepted.error));
        }
        const employeeId = await getCurrentUserId(client);

        await client.identity.logout({});
        await loginAdmin();

        const unassigned = await client.employee.unassignRole({
          company: companyIdentifier,
          employeeIdentifier: employeeId,
          role: 'admin',
        });

        if (!unassigned.success) {
          assert.fail(JSON.stringify(unassigned.error));
        }

        expect(unassigned.value.role).toBe('employee');
      }, 50000);

      it('allows admin to remove an employee from the company', async () => {
        const inviteeEmail = testData.employeeEmail(Date.now().toString());
        const invite = await inviteEmployee(inviteeEmail, 'manager');

        const accepted = await registerAndAcceptInvitation(invite, inviteeEmail);
        if (!accepted.success) {
          assert.fail(JSON.stringify(accepted.error));
        }
        const employeeId = await getCurrentUserId(client);

        await client.identity.logout({});
        await loginAdmin();

        const removed = await client.employee.removeEmployee({
          company: companyIdentifier,
          employeeIdentifier: employeeId,
        });
        if (!removed.success) {
          assert.fail(JSON.stringify(removed.error));
        }

        const lookup = await client.employee.getByEmail({
          company: companyIdentifier,
          email: inviteeEmail,
        });
        expect(lookup.success).toBe(false);
      }, 20000);


      it('allows listing employees in an company', async () => {
        const inviteeEmail = testData.employeeEmail(Date.now().toString());
        const invite = await inviteEmployee(inviteeEmail, 'manager');

        const accepted = await registerAndAcceptInvitation(invite, inviteeEmail);
        if (!accepted.success) {
          assert.fail(JSON.stringify(accepted.error));
        }

        await client.identity.logout({});
        await loginAdmin();

        const listResult = await client.employee.listEmployees({
          search: {
            company: companyIdentifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10
            }
          },
        });
        if (!listResult.success) {
          assert.fail(JSON.stringify(listResult.error));
        }

        const found = listResult.value.items.find((item) => item.email === inviteeEmail);
        expect(found).toBeDefined();
        expect(found?.email).toBe(inviteeEmail);
        expect(found?.firstName).toBeTruthy();
        expect(found?.lastName).toBeTruthy();
      }, 20000);
    });
  },
);

