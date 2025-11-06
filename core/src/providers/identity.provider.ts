import type { Identity } from "../schemas/models/identity.model.js";
import type { IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister } from "../schemas/mutations/identity.mutation.js";
import type { IdentityQuerySelf } from "../schemas/queries/identity.query.js";
import { BaseProvider } from "./base.provider.js";

export abstract class IdentityProvider<
  T extends Identity = Identity,
> extends BaseProvider<T> {
  public abstract getSelf(payload: IdentityQuerySelf): Promise<T>;
  public abstract login(payload: IdentityMutationLogin): Promise<T>;
  public abstract logout(payload: IdentityMutationLogout): Promise<T>;
  public abstract register(payload: IdentityMutationRegister): Promise<T>;

  protected override getResourceName(): string {
    return 'identity';
  }
}
