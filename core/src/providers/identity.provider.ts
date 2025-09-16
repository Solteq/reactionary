import { Identity } from "../schemas/models/identity.model";
import { IdentityMutationLogin, IdentityMutationLogout } from "../schemas/mutations/identity.mutation";
import { IdentityQuerySelf } from "../schemas/queries/identity.query";
import { Session } from "../schemas/session.schema";
import { BaseProvider } from "./base.provider";

export abstract class IdentityProvider<
  T extends Identity = Identity,
> extends BaseProvider<T> {
  public abstract getSelf(payload: IdentityQuerySelf, session: Session): Promise<T>;
  public abstract login(payload: IdentityMutationLogin, session: Session): Promise<T>;
  public abstract logout(payload: IdentityMutationLogout, session: Session): Promise<T>;

  protected override getResourceName(): string {
    return 'identity';
  }
}
