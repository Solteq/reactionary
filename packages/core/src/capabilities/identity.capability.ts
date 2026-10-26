import type { ExternalLoginRedirect, IdentityProvider } from "../schemas/models/identity-provider.model.js";
import type { Identity } from "../schemas/models/identity.model.js";
import type { IdentityConflictError } from "../schemas/errors/identity-conflict.error.js";
import type { IdentityMutationCompleteExternalLogin, IdentityMutationLogin, IdentityMutationLogout, IdentityMutationRegister, IdentityMutationStartExternalLogin } from "../schemas/mutations/identity.mutation.js";
import type { IdentityQueryProviders, IdentityQuerySelf } from "../schemas/queries/identity.query.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

const PENDING_EXTERNAL_LOGIN_TTL_MS = 10 * 60 * 1000;

export abstract class IdentityCapability<TIdentity extends Identity = Identity> extends BaseCapability {
  public abstract getSelf(payload: IdentityQuerySelf): Promise<Result<TIdentity>>;
  public abstract login(payload: IdentityMutationLogin): Promise<Result<TIdentity>>;
  public abstract logout(payload: IdentityMutationLogout): Promise<Result<TIdentity>>;
  public abstract register(payload: IdentityMutationRegister): Promise<Result<TIdentity>>;

  /** The ways a shopper can sign in with this backend. */
  public abstract listProviders(payload: IdentityQueryProviders): Promise<Result<IdentityProvider[]>>;
  /** Begins a redirect flow. The caller sends the shopper to the returned location. */
  public abstract startExternalLogin(payload: IdentityMutationStartExternalLogin): Promise<Result<ExternalLoginRedirect>>;
  /** Completes a redirect flow from the parameters the identity provider appended to the callback URL. */
  public abstract completeExternalLogin(payload: IdentityMutationCompleteExternalLogin): Promise<Result<TIdentity, IdentityConflictError>>;

  protected override getResourceName(): string {
    return 'identity';
  }

  protected updateIdentityContext(identity: TIdentity) {
    this.context.session.identityContext.lastUpdated = new Date();
    // What an external login learned about the shopper goes to the caller of completeExternalLogin, not into the session
    if (identity.type === 'Registered') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { externalLogin, ...registered } = identity;
      this.context.session.identityContext.identity = registered as Identity;
      return;
    }
    this.context.session.identityContext.identity = identity as Identity;
  }

  protected setPendingExternalLogin(provider: string, state: string, data?: Record<string, string>) {
    this.context.session.identityContext.pendingExternalLogin = {
      provider,
      state,
      createdAt: new Date(),
      ...(data ? { data } : {}),
    };
  }

  /**
   * Returns the pending login, and clears it, when provider and state match a login started in this session within
   * the last 10 minutes. Returns undefined otherwise. A pending login can only be taken once.
   */
  protected takePendingExternalLogin(provider: string, state: string | undefined): { data: Record<string, string> } | undefined {
    const pending = this.context.session.identityContext.pendingExternalLogin;
    delete this.context.session.identityContext.pendingExternalLogin;
    if (!pending || !state) {
      return undefined;
    }
    const fresh = Date.now() - new Date(pending.createdAt).getTime() <= PENDING_EXTERNAL_LOGIN_TTL_MS;
    if (!fresh || pending.provider !== provider || pending.state !== state) {
      return undefined;
    }
    return { data: pending.data ?? {} };
  }

  /** Returns true, and clears the pending login, when provider and state match a login started in this session within the last 10 minutes. */
  protected consumePendingExternalLogin(provider: string, state: string | undefined): boolean {
    return this.takePendingExternalLogin(provider, state) !== undefined;
  }
}
