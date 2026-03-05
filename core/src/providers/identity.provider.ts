import type { Identity } from "../schemas/models/identity.model.js";
import type { IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister } from "../schemas/mutations/identity.mutation.js";
import type { IdentityQuerySelf } from "../schemas/queries/identity.query.js";
import type { Result } from "../schemas/result.js";
import { BaseProvider } from "./base.provider.js";

export abstract class IdentityProvider<TIdentity extends Identity = Identity> extends BaseProvider {
  public abstract getSelf(payload: IdentityQuerySelf): Promise<Result<TIdentity>>;
  public abstract login(payload: IdentityMutationLogin): Promise<Result<TIdentity>>;
  public abstract logout(payload: IdentityMutationLogout): Promise<Result<TIdentity>>;
  public abstract register(payload: IdentityMutationRegister): Promise<Result<TIdentity>>;

  protected override getResourceName(): string {
    return 'identity';
  }

  protected updateIdentityContext(identity: TIdentity) {
    this.context.session.identityContext.lastUpdated = new Date();
    this.context.session.identityContext.identity = identity as Identity;
  }
}
