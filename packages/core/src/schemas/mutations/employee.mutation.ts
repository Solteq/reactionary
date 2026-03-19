import * as z from 'zod';
import {
  IdentityIdentifierSchema,
  EmployeeRoleSchema,
  CompanyIdentifierSchema,
} from '../models/identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

export const EmployeeMutationAssignRoleSchema = z.object({
  company: CompanyIdentifierSchema,
  employeeIdentifier: IdentityIdentifierSchema,
  role: EmployeeRoleSchema.meta({
    description:
      'The role to assign to the employee. This can be used to determine what permissions and access the employee will have in the storefront.',
  }),
});

export const EmployeeMutationUnassignRoleSchema = z.object({
  company: CompanyIdentifierSchema,
  employeeIdentifier: IdentityIdentifierSchema,
  role: EmployeeRoleSchema.meta({
    description:
      'The role to unassign from the employee. This can be used to determine what permissions and access the employee will have in the storefront.',
  }),
});

export const EmployeeMutationRemoveEmployeeSchema = z.object({
  company: CompanyIdentifierSchema,
  employeeIdentifier: IdentityIdentifierSchema,
});

export type EmployeeMutationAssignRole = InferType<
  typeof EmployeeMutationAssignRoleSchema
>;
export type EmployeeMutationUnassignRole = InferType<
  typeof EmployeeMutationUnassignRoleSchema
>;
export type EmployeeMutationRemoveEmployee = InferType<
  typeof EmployeeMutationRemoveEmployeeSchema
>;
