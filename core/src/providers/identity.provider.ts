import type { Identity } from "../schemas/models/identity.model.js";
import type { IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister } from "../schemas/mutations/identity.mutation.js";
import type { IdentityQuerySelf } from "../schemas/queries/identity.query.js";
import { BaseProvider } from "./base.provider.js";

export abstract class IdentityProvider extends BaseProvider {
  public abstract getSelf(payload: IdentityQuerySelf): Promise<Identity>;
  public abstract login(payload: IdentityMutationLogin): Promise<Identity>;
  public abstract logout(payload: IdentityMutationLogout): Promise<Identity>;
  public abstract register(payload: IdentityMutationRegister): Promise<Identity>;

  protected override getResourceName(): string {
    return 'identity';
  }
}
