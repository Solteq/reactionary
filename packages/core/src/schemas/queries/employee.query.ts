import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { BaseQuerySchema } from './base.query.js';
import {
  CompanyIdentifierSchema,
  EmployeeSearchIdentifierSchema,
} from '../models/identifiers.model.js';

export const EmployeeQueryListSchema = BaseQuerySchema.extend({
  search: EmployeeSearchIdentifierSchema,
});

export const EmployeeQueryByEmailSchema = BaseQuerySchema.extend({
  company: CompanyIdentifierSchema,
  email: z.email().meta({
    description:
      'The email of the employee to fetch. This can be used to fetch a specific employee by their email address, which is often a unique identifier for users in the system.',
  }),
});

export type EmployeeQueryList = InferType<typeof EmployeeQueryListSchema>;
export type EmployeeQueryByEmail = InferType<typeof EmployeeQueryByEmailSchema>;
