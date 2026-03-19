import type { NotFoundError } from '../schemas/index.js';
import type {
  Employee,
  EmployeePaginatedList,
} from '../schemas/models/employee.model.js';
import type {
  EmployeeMutationAssignRole,
  EmployeeMutationUnassignRole,
  EmployeeMutationRemoveEmployee,
} from '../schemas/mutations/employee.mutation.js';
import type {
  EmployeeQueryByEmail,
  EmployeeQueryList,
} from '../schemas/queries/employee.query.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

export abstract class EmployeeCapability extends BaseCapability {
  protected override getResourceName(): string {
    return 'employees';
  }

  public abstract listEmployees(
    payload: EmployeeQueryList,
  ): Promise<Result<EmployeePaginatedList>>;

  public abstract getByEmail(
    payload: EmployeeQueryByEmail,
  ): Promise<Result<Employee>>;

  public abstract assignRole(
    payload: EmployeeMutationAssignRole,
  ): Promise<Result<Employee, NotFoundError>>;

  public abstract unassignRole(
    payload: EmployeeMutationUnassignRole,
  ): Promise<Result<Employee, NotFoundError>>;

  public abstract removeEmployee(
    payload: EmployeeMutationRemoveEmployee,
  ): Promise<Result<void, NotFoundError>>;
}
