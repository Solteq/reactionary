import type * as z from 'zod';
import type {
  EmployeePaginatedListSchema,
  EmployeeSchema,
} from '../schemas/models/employee.model.js';
import type { EmployeeRole } from '../schemas/models/identifiers.model.js';
import type { EmployeeQueryList } from '../schemas/queries/employee.query.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyEmployeeSchema = z.ZodType<z.output<typeof EmployeeSchema>>;
export type AnyEmployeePaginatedListSchema = z.ZodType<
  z.output<typeof EmployeePaginatedListSchema>
>;

export interface EmployeeFactory<
  TEmployeeSchema extends AnyEmployeeSchema = AnyEmployeeSchema,
  TEmployeePaginatedListSchema extends
    AnyEmployeePaginatedListSchema = AnyEmployeePaginatedListSchema,
> {
  employeeSchema: TEmployeeSchema;
  employeePaginatedListSchema: TEmployeePaginatedListSchema;
  parseEmployee(context: RequestContext, data: unknown): z.output<TEmployeeSchema>;
  parseEmployeePaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeQueryList,
  ): z.output<TEmployeePaginatedListSchema>;
  mapRole(role: EmployeeRole): string;
}

export type EmployeeFactoryOutput<TFactory extends EmployeeFactory> = ReturnType<
  TFactory['parseEmployee']
>;

export type EmployeePaginatedListFactoryOutput<TFactory extends EmployeeFactory> =
  ReturnType<TFactory['parseEmployeePaginatedList']>;

export type EmployeeFactoryWithOutput<TFactory extends EmployeeFactory> = Omit<
  TFactory,
  'parseEmployee' | 'parseEmployeePaginatedList'
> & {
  parseEmployee(
    context: RequestContext,
    data: unknown,
  ): EmployeeFactoryOutput<TFactory>;
  parseEmployeePaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeQueryList,
  ): EmployeePaginatedListFactoryOutput<TFactory>;
};
