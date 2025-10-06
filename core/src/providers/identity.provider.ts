import type { Identity } from "../schemas/models/identity.model";
import type { IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister } from "../schemas/mutations/identity.mutation";
import type { IdentityQuerySelf } from "../schemas/queries/identity.query";
import type { RequestContext} from "../schemas/session.schema";
import { BaseProvider } from "./base.provider";

export abstract class IdentityProvider<
  T extends Identity = Identity,
> extends BaseProvider<T> {
  public abstract getSelf(payload: IdentityQuerySelf, reqCtx: RequestContext): Promise<T>;
  public abstract login(payload: IdentityMutationLogin, reqCtx: RequestContext): Promise<T>;
  public abstract logout(payload: IdentityMutationLogout, reqCtx: RequestContext): Promise<T>;
  public abstract register(payload: IdentityMutationRegister, reqCtx: RequestContext): Promise<T>;

  protected override getResourceName(): string {
    return 'identity';
  }
}
