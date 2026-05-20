import {
  type AnonymousIdentity,
  type Cache,
  type GuestIdentity,
  type IdentityFactory,
  type IdentityFactoryOutput,
  type IdentityFactoryWithOutput,
  type IdentityMutationLogin,
  IdentityMutationLoginSchema,
  type IdentityMutationLogout,
  IdentityMutationLogoutSchema,
  type IdentityMutationRegister,
  IdentityMutationRegisterSchema,
  type IdentityQuerySelf,
  IdentityQuerySelfSchema,
  IdentityCapability,
  IdentitySchema,
  type RegisteredIdentity,
  type RequestContext,
  type Result,
  Reactionary,
  success,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclIdentityFactory } from '../factories/identity/identity.factory.js';
import type {
  HclPersonResponse,
  HclWcsIdentityResponse,
} from '../schema/hcl.schema.js';
import {
  SESSION_KEY_WC_TOKEN,
  SESSION_KEY_WC_TRUSTED_TOKEN,
  SESSION_KEY_USER_ID,
  SESSION_KEY_IDENTITY_TYPE,
  SESSION_KEY_PERSONALIZATION_ID,
} from '../core/session-keys.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:hcl:identity');

export class HclIdentityCapability<
  TFactory extends IdentityFactory = HclIdentityFactory,
> extends IdentityCapability<IdentityFactoryOutput<TFactory>> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: IdentityFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: IdentityFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(
    _payload: IdentityQuerySelf,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const wcToken = this.context.session[SESSION_KEY_WC_TOKEN] as
      | string
      | undefined;

    if (!wcToken) {
      debug('No WCS session token — returning anonymous identity');
      // Ensure a personalization ID exists for anonymous browsing.
      // This lightweight ID is sent as the WCPersonalization header so WCS can
      // provide personalised responses without creating a full guest-identity
      // row in the database. A full guest session is only created when the user
      // actually manifests state (e.g. adds to cart).
      if (!this.context.session[SESSION_KEY_PERSONALIZATION_ID]) {
        this.context.session[SESSION_KEY_PERSONALIZATION_ID] = crypto
          .randomUUID()
          .replace(/-/g, '')
          .slice(0, 30);
      }
      const parsed = this.factory.parseIdentity(this.context, {
        type: 'Anonymous',
      } satisfies AnonymousIdentity) as IdentityFactoryOutput<TFactory>;
      this.updateIdentityContext(parsed);
      return success(parsed);
    }

    const identityType = this.context.session[SESSION_KEY_IDENTITY_TYPE] as
      | string
      | undefined;
    const userId = this.context.session[SESSION_KEY_USER_ID] as
      | string
      | undefined;

    if (identityType === 'registered' && userId) {
      debug('Registered session found for userId %s', userId);
      const parsed = this.factory.parseIdentity(this.context, {
        type: 'Registered',
        id: { userId },
      } satisfies RegisteredIdentity) as IdentityFactoryOutput<TFactory>;
      this.updateIdentityContext(parsed);
      return success(parsed);
    }

    if (identityType === 'guest' && userId) {
      debug('Guest session found for userId %s', userId);
      const parsed = this.factory.parseIdentity(this.context, {
        type: 'Guest',
        id: { userId },
      } satisfies GuestIdentity) as IdentityFactoryOutput<TFactory>;
      this.updateIdentityContext(parsed);
      return success(parsed);
    }

    // Token present but type unknown — treat as anonymous
    debug('WCS token present but identity type unknown — returning anonymous');
    const parsed = this.factory.parseIdentity(this.context, {
      type: 'Anonymous',
    } satisfies AnonymousIdentity) as IdentityFactoryOutput<TFactory>;
    this.updateIdentityContext(parsed);
    return success(parsed);
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(
    payload: IdentityMutationLogin,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    debug('Attempting login for user: %s', payload.username);

    const response = await this.loginIdentity(
      payload.username,
      payload.password,
    );

    this.storeSessionTokens(
      response.WCToken,
      response.WCTrustedToken,
      response.userId,
      'registered',
      response.personalizationID,
    );

    const loginParsed = this.factory.parseIdentity(this.context, {
      type: 'Registered',
      id: { userId: response.userId },
    } satisfies RegisteredIdentity) as IdentityFactoryOutput<TFactory>;
    this.updateIdentityContext(loginParsed);
    return success(loginParsed);
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema,
  })
  public override async logout(
    _payload: IdentityMutationLogout,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    debug('Logging out current session');

    const wcToken = this.context.session[SESSION_KEY_WC_TOKEN] as
      | string
      | undefined;
    const userId = this.context.session[SESSION_KEY_USER_ID] as
      | string
      | undefined;

    // Best-effort server-side logout — silently ignored if endpoint not supported.
    // Auth headers are read automatically from the context by the client.
    if (wcToken && userId) {
      try {
        await this.deleteLoginIdentity(userId);
      } catch (err) {
        debug('Server-side logout failed (non-fatal): %o', err);
      }
    }

    this.clearSessionTokens();

    const logoutParsed = this.factory.parseIdentity(this.context, {
      type: 'Anonymous',
    } satisfies AnonymousIdentity) as IdentityFactoryOutput<TFactory>;
    this.updateIdentityContext(logoutParsed);
    return success(logoutParsed);
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    debug('Registering new user: %s', payload.username);

    // WCS requires a guest session before registering a new person.
    const guest = await this.createGuestIdentity();
    this.storeSessionTokens(
      guest.WCToken,
      guest.WCTrustedToken,
      guest.userId,
      'guest',
      guest.personalizationID,
    );

    // Register the person — the guest session tokens are now stored in the
    // context so the client reads them automatically via buildHeaders().
    const registered = await this.registerPerson(
      payload.username,
      payload.password,
    );

    this.storeSessionTokens(
      registered.WCToken,
      registered.WCTrustedToken,
      registered.userId,
      'registered',
      registered.personalizationID,
    );

    const registerParsed = this.factory.parseIdentity(this.context, {
      type: 'Registered',
      id: { userId: registered.userId },
    } satisfies RegisteredIdentity) as IdentityFactoryOutput<TFactory>;
    this.updateIdentityContext(registerParsed);
    return success(registerParsed);
  }

  private storeSessionTokens(
    wcToken: string,
    wcTrustedToken: string,
    userId: string,
    identityType: 'anonymous' | 'guest' | 'registered',
    personalizationID?: string,
  ): void {
    this.context.session[SESSION_KEY_WC_TOKEN] = wcToken;
    this.context.session[SESSION_KEY_WC_TRUSTED_TOKEN] = wcTrustedToken;
    this.context.session[SESSION_KEY_USER_ID] = userId;
    this.context.session[SESSION_KEY_IDENTITY_TYPE] = identityType;
    if (personalizationID) {
      this.context.session[SESSION_KEY_PERSONALIZATION_ID] = personalizationID;
    } else {
      delete this.context.session[SESSION_KEY_PERSONALIZATION_ID];
    }
  }

  private clearSessionTokens(): void {
    delete this.context.session[SESSION_KEY_WC_TOKEN];
    delete this.context.session[SESSION_KEY_WC_TRUSTED_TOKEN];
    delete this.context.session[SESSION_KEY_USER_ID];
    delete this.context.session[SESSION_KEY_IDENTITY_TYPE];
    delete this.context.session[SESSION_KEY_PERSONALIZATION_ID];
  }

  // ---------------------------------------------------------------------------
  // Protected fetch methods — override in subclasses to customise API calls
  // ---------------------------------------------------------------------------

  protected async loginIdentity(
    logonId: string,
    logonPassword: string,
  ): Promise<HclWcsIdentityResponse> {
    return this.client.callPost<HclWcsIdentityResponse>(
      `${this.client.transactionBaseUrl}/loginidentity`,
      { logonId, logonPassword },
    );
  }

  protected async deleteLoginIdentity(userId: string): Promise<void> {
    await this.client.callDelete(
      `${this.client.transactionBaseUrl}/loginidentity/${encodeURIComponent(userId)}`,
      { ignore404: true },
    );
  }

  /**
   * Create an anonymous guest session.
   * Only call this when the user actually needs a persisted session (e.g. on
   * cart creation). For pure browsing, a personalization ID is sufficient.
   */
  protected async createGuestIdentity(): Promise<HclWcsIdentityResponse> {
    return this.client.callPost<HclWcsIdentityResponse>(
      `${this.client.transactionBaseUrl}/guestidentity`,
    );
  }

  /**
   * Register a new person. Requires an active guest session already stored in
   * the context (guest tokens are picked up automatically by buildHeaders).
   */
  protected async registerPerson(
    logonId: string,
    logonPassword: string,
  ): Promise<HclWcsIdentityResponse> {
    return this.client.callPut<HclWcsIdentityResponse>(
      `${this.client.transactionBaseUrl}/person/@self`,
      {
        logonId,
        logonPassword,
        logonPasswordVerify: logonPassword,
      },
    );
  }

  protected async getSelfPerson(): Promise<HclPersonResponse> {
    return this.client.callGet<HclPersonResponse>(
      `${this.client.transactionBaseUrl}/person/@self`,
    );
  }
}
