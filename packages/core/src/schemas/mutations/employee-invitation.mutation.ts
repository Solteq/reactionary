import * as z from "zod";
import { EmployeeInvitationIdentifierSchema, EmployeeRoleSchema, CompanyIdentifierSchema } from "../models/identifiers.model.js";
import type { InferType } from "../../zod-utils.js";

export const EmployeeInvitationMutationInviteEmployeeSchema = z.object({
  company: CompanyIdentifierSchema,
  email: z.email().meta({ description: 'The email of the invited employee. This is the email that the invitation will be sent to, and that the employee will use to accept the invitation and create their account.' }),
  role: EmployeeRoleSchema.meta({ description: 'The role that the invited employee will have in the company. This can be used to determine what permissions and access the employee will have once they accept the invitation.' }),
});

export const EmployeeInvitationMutationAcceptInvitationSchema = z.object({
  invitationIdentifier: EmployeeInvitationIdentifierSchema,
  securityToken: z.string().meta({ description: 'The security token for accepting the invitation. This is used to verify that the person accepting the invitation has access to the email it was sent to.' }),
  currentUserEmail: z.email().meta({ description: 'The email of the employee accepting the invitation. This is used to verify that the person accepting the invitation is the same as the one it was sent to.' }),
});

export const EmployeeInvitationMutationRevokeInvitationSchema = z.object({
  invitationIdentifier: EmployeeInvitationIdentifierSchema,
});

export type EmployeeInvitationMutationInviteEmployee = InferType<typeof EmployeeInvitationMutationInviteEmployeeSchema>;
export type EmployeeInvitationMutationAcceptInvitation = InferType<typeof EmployeeInvitationMutationAcceptInvitationSchema>;
export type EmployeeInvitationMutationRevokeInvitation = InferType<typeof EmployeeInvitationMutationRevokeInvitationSchema>;
