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
  'Employee Invitations - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;
    let company: Company | null;
    let companyIdentifier: CompanyIdentifier;
    let testOrg: ReturnType<typeof testData.requestTemplate>;
    let adminUsername = '';
    const adminPassword = 'password1235!';

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
      company = null;

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
      company = orgResponse.value;
    }, 15000);

    it('should allow inviting a new employee to the company', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      expect(invite.email).toBe(inviteeEmail);
      expect(invite.identifier.key).toBeTruthy();
      expect(invite.securityToken).toBeTruthy();
      expect(invite.status).toBe('invited');
    });

    it('should allow accepting an invitation with a token', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      const accepted = await registerAndAcceptInvitation(invite, inviteeEmail);
      if (!accepted.success) {
        assert.fail(JSON.stringify(accepted.error));
      }

      expect(accepted.value.email).toBe(inviteeEmail);
      expect(accepted.value.company.taxIdentifier).toBe(companyIdentifier.taxIdentifier);

      await client.identity.logout({});
      await loginAdmin();
      const lookup = await client.employee.getByEmail({
        company: companyIdentifier,
        email: inviteeEmail,
      });
      if (!lookup.success) {
        assert.fail(JSON.stringify(lookup.error));
      }
    }, 20000);

    it('should not allow accepting the invitation with the wrong email', async () => {
      const ts = Date.now().toString();
      const invitedEmail = testData.employeeEmail(ts);
      const wrongEmail = testData.wrongEmail(ts);
      const invite = await inviteEmployee(invitedEmail, 'manager');

      await client.identity.logout({});
      await registerUserAndAssert(wrongEmail, adminPassword);

      const accepted = await client.employeeInvitation.acceptInvitation({
        invitationIdentifier: invite.identifier,
        securityToken: invite.securityToken,
        currentUserEmail: wrongEmail,
      });

      expect(accepted.success).toBe(false);
    }, 20000);

    it('should not allow accepting the invitation with the wrong token', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      await client.identity.logout({});
      await registerUserAndAssert(inviteeEmail, adminPassword);

      const accepted = await client.employeeInvitation.acceptInvitation({
        invitationIdentifier: invite.identifier,
        securityToken: `${invite.securityToken}-wrong`,
        currentUserEmail: inviteeEmail,
      });

      expect(accepted.success).toBe(false);
    }, 20000);

    it('allows admin to revoke the invitation', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      const revoked = await client.employeeInvitation.revokeInvitation({
        invitationIdentifier: invite.identifier,
      });
      if (!revoked.success) {
        assert.fail(JSON.stringify(revoked.error));
      }

      await client.identity.logout({});
      await registerUserAndAssert(inviteeEmail, adminPassword);
      const accepted = await client.employeeInvitation.acceptInvitation({
        invitationIdentifier: invite.identifier,
        securityToken: invite.securityToken,
        currentUserEmail: inviteeEmail,
      });
      expect(accepted.success).toBe(false);
    }, 20000);

    it('allows admin to list all invitations for the company', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      const listResult = await client.employeeInvitation.listInvitations({
        search: {
          company: companyIdentifier,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 20,
          },
        },
      });

      if (!listResult.success) {
        assert.fail(JSON.stringify(listResult.error));
      }

      const found = listResult.value.items.find((item) => item.identifier.key === invite.identifier.key);
      expect(found).toBeDefined();
      expect(found?.email).toBe(inviteeEmail);
    }, 20000)

    it('allows recipient to list all invitations relevant for them', async () => {
      const inviteeEmail = testData.employeeEmail(Date.now().toString());
      const invite = await inviteEmployee(inviteeEmail, 'manager');

      await client.identity.logout({});
      await registerUserAndAssert(inviteeEmail, adminPassword);

      const listResult = await client.employeeInvitation.listInvitations({
        search: {
          email: inviteeEmail,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 20,
          },
        },
      });

      if (!listResult.success) {
        assert.fail(JSON.stringify(listResult.error));
      }

      const found = listResult.value.items.find((item) => item.identifier.key === invite.identifier.key);
      expect(found).toBeDefined();
    }, 20000);
  },
);
