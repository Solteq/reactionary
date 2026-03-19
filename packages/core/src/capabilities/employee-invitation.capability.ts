import type { NotFoundError } from "../schemas/index.js";
import type { EmployeeInvitation, EmployeeIssuedInvitation, EmployeeInvitationPaginatedList } from "../schemas/models/index.js";
import type { EmployeeInvitationMutationAcceptInvitation, EmployeeInvitationMutationInviteEmployee, EmployeeInvitationMutationRevokeInvitation } from "../schemas/mutations/index.js";
import type { EmployeeInvitationQueryList } from "../schemas/queries/index.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class EmployeeInvitationCapability extends BaseCapability {

  protected override getResourceName(): string {
    return 'employee-invitation';
  }

  /**
   * Usecase:
   * List all open invitations sent to employees to join the company.
   * In my-account store management, you want to see a list of all pending invitations that have been sent to employees to join the company, so you can keep track of who has been invited and resend or revoke invitations if needed.
   * @param payload
   */
  public abstract listInvitations( payload: EmployeeInvitationQueryList ): Promise<Result<EmployeeInvitationPaginatedList>>;

  /**
   * Usecase:
   * You are an admin of a company, and you want to invite co-workers to join the company.
   * @param payload
   */
  public abstract inviteEmployee( payload: EmployeeInvitationMutationInviteEmployee ): Promise<Result<EmployeeIssuedInvitation>>;

  /**
   * Usecase:
   * As a co-worker you received the invitation, and you want to accept it so you can start accessing the storefront on behalf of the company.
   * @param payload
   */
  public abstract acceptInvitation( payload: EmployeeInvitationMutationAcceptInvitation ): Promise<Result<EmployeeInvitation>>;

  /**
   * Usecase:
   * As an admin you changed your mind, and no longer want the invited co-worker to join the company, or you invited the wrong email by mistake. You want to revoke the invitation so that the co-worker can no longer accept it and join the company.
   * @param payload
   */
  public abstract revokeInvitation( payload: EmployeeInvitationMutationRevokeInvitation ): Promise<Result<void, NotFoundError>>;
}
