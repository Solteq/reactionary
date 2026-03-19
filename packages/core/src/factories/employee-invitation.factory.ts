import type * as z from 'zod';
import type {
  EmployeeInvitationPaginatedListSchema,
  EmployeeInvitationSchema,
  EmployeeIssuedInvitationSchema,
} from '../schemas/models/employee-invitation.model.js';
import type { EmployeeRole } from '../schemas/models/identifiers.model.js';
import type { EmployeeInvitationMutationInviteEmployee } from '../schemas/mutations/employee-invitation.mutation.js';
import type { EmployeeInvitationQueryList } from '../schemas/queries/employee-invitation.query.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyEmployeeInvitationSchema = z.ZodType<
  z.output<typeof EmployeeInvitationSchema>
>;
export type AnyEmployeeIssuedInvitationSchema = z.ZodType<
  z.output<typeof EmployeeIssuedInvitationSchema>
>;
export type AnyEmployeeInvitationPaginatedListSchema = z.ZodType<
  z.output<typeof EmployeeInvitationPaginatedListSchema>
>;

export interface EmployeeInvitationFactory<
  TEmployeeInvitationSchema extends
    AnyEmployeeInvitationSchema = AnyEmployeeInvitationSchema,
  TEmployeeIssuedInvitationSchema extends
    AnyEmployeeIssuedInvitationSchema = AnyEmployeeIssuedInvitationSchema,
  TEmployeeInvitationPaginatedListSchema extends
    AnyEmployeeInvitationPaginatedListSchema = AnyEmployeeInvitationPaginatedListSchema,
> {
  employeeInvitationSchema: TEmployeeInvitationSchema;
  employeeIssuedInvitationSchema: TEmployeeIssuedInvitationSchema;
  employeeInvitationPaginatedListSchema: TEmployeeInvitationPaginatedListSchema;
  parseEmployeeInvitation(
    context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeInvitationSchema>;
  parseEmployeeIssuedInvitation(
    context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): z.output<TEmployeeIssuedInvitationSchema>;
  parseEmployeeInvitationPaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeInvitationQueryList,
  ): z.output<TEmployeeInvitationPaginatedListSchema>;
  mapRole(role: EmployeeRole): string;
}

export type EmployeeInvitationFactoryOutput<
  TFactory extends EmployeeInvitationFactory,
> = ReturnType<TFactory['parseEmployeeInvitation']>;

export type EmployeeIssuedInvitationFactoryOutput<
  TFactory extends EmployeeInvitationFactory,
> = ReturnType<TFactory['parseEmployeeIssuedInvitation']>;

export type EmployeeInvitationPaginatedListFactoryOutput<
  TFactory extends EmployeeInvitationFactory,
> = ReturnType<TFactory['parseEmployeeInvitationPaginatedList']>;

export type EmployeeInvitationFactoryWithOutput<
  TFactory extends EmployeeInvitationFactory,
> = Omit<
  TFactory,
  | 'parseEmployeeInvitation'
  | 'parseEmployeeIssuedInvitation'
  | 'parseEmployeeInvitationPaginatedList'
> & {
  parseEmployeeInvitation(
    context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): EmployeeInvitationFactoryOutput<TFactory>;
  parseEmployeeIssuedInvitation(
    context: RequestContext,
    data: unknown,
    payload?: EmployeeInvitationMutationInviteEmployee,
  ): EmployeeIssuedInvitationFactoryOutput<TFactory>;
  parseEmployeeInvitationPaginatedList(
    context: RequestContext,
    data: unknown,
    query: EmployeeInvitationQueryList,
  ): EmployeeInvitationPaginatedListFactoryOutput<TFactory>;
};
