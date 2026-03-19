import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { createPaginatedResponseSchema } from './base.model.js';
import { IdentityIdentifierSchema, EmployeeRoleSchema, CompanyIdentifierSchema, EmployeeSearchIdentifierSchema } from './identifiers.model.js';
import { MonetaryAmountSchema } from './price.model.js';

/**
 * This represents the relationship between a company and an employee.
 * It supports providing some basic information about the employee, as well as a reference to their full profile (which you may or may not be able to load)
 **/
export const EmployeeSchema = z.looseObject({
  identifier: IdentityIdentifierSchema,
  company: CompanyIdentifierSchema,
  firstName: z.string().optional().meta({ description: 'The first name of the employee. This is the human readable name that will be displayed in the UI.' }),
  lastName: z.string().optional().meta({ description: 'The last name of the employee. This is the human readable name that will be displayed in the UI.' }),
  email: z.email().meta({ description: 'The email of the employee. This is the email that the employee uses to log in and access the storefront.' }),
  role: EmployeeRoleSchema.meta({ description: 'The role of the employee in the company. This can be used to determine what permissions and access the employee has in the storefront.' }),
  spendingLimit: MonetaryAmountSchema.optional().meta({ description: 'The spending limit for the employee. This can be used to restrict the amount of money the employee can spend when placing orders on behalf of the company.' }),
});

export const EmployeePaginatedListSchema = createPaginatedResponseSchema(EmployeeSchema).extend({
    identifier: EmployeeSearchIdentifierSchema,
});

export type Employee = InferType<typeof EmployeeSchema>;
export type EmployeePaginatedList = InferType<typeof EmployeePaginatedListSchema>;
