import type { Identity } from "../schemas/models/identity.model.js";
import type { IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister } from "../schemas/mutations/identity.mutation.js";
import type { IdentityQuerySelf } from "../schemas/queries/identity.query.js";
import type { Result } from "../schemas/result.js";
import { BaseProvider } from "./base.provider.js";

export abstract class IdentityProvider extends BaseProvider {
  public abstract getSelf(payload: IdentityQuerySelf): Promise<Result<Identity>>;
  public abstract login(payload: IdentityMutationLogin): Promise<Result<Identity>>;
  public abstract logout(payload: IdentityMutationLogout): Promise<Result<Identity>>;
  public abstract register(payload: IdentityMutationRegister): Promise<Result<Identity>>;

  protected override getResourceName(): string {
    return 'identity';
  }
}
