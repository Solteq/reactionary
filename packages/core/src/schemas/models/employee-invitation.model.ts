import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { createPaginatedResponseSchema } from './base.model.js';
import { EmployeeInvitationIdentifierSchema, EmployeeInvitationSearchIdentifierSchema, EmployeeInvitationStatusSchema, EmployeeRoleSchema, CompanyIdentifierSchema } from './identifiers.model.js';

/**
 * Represents an employee invitation to join a company.
 **/
export const EmployeeInvitationSchema = z.looseObject({
  identifier: EmployeeInvitationIdentifierSchema,
  company: CompanyIdentifierSchema,
  status: EmployeeInvitationStatusSchema.meta({ description: 'The status of the invitation. This can be used to determine if the invitation is still pending, if it has been accepted by the employee, if it has been revoked by an admin, or if it has been rejected by the employee.' }),
  email: z.email().meta({ description: 'The email of the invited employee. This is the email that the invitation was sent to, and that the employee will use to accept the invitation and create their account.' }),
  role: EmployeeRoleSchema.meta({ description: 'The role that the invited employee will have in the company. This can be used to determine what permissions and access the employee will have once they accept the invitation.' }),
  validUntil: z.string().meta({ description: 'The date until the invitation is valid. After this date, the invitation can no longer be accepted by the employee.' }),
});

export const EmployeeIssuedInvitationSchema = EmployeeInvitationSchema.extend({
  securityToken: z.string().meta({ description: 'The token for the invitation. This is used to accept the invitation and should be kept secret.' }),
})

export const EmployeeInvitationPaginatedListSchema = createPaginatedResponseSchema(EmployeeInvitationSchema).extend({
    identifier: EmployeeInvitationSearchIdentifierSchema,
});

export type EmployeeInvitation = InferType<typeof EmployeeInvitationSchema>;
export type EmployeeIssuedInvitation = InferType<typeof EmployeeIssuedInvitationSchema>;
export type EmployeeInvitationPaginatedList = InferType<typeof EmployeeInvitationPaginatedListSchema>;
