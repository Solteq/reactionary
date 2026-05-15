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
import type { HclTransactionClient } from '../core/transaction-client.js';
import type { HclIdentityFactory } from '../factories/identity/identity.factory.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:hcl:identity');

/**
 * Session keys used to persist WCS auth tokens across requests.
 * Using the `hcl.` prefix per provider convention.
 */
const SESSION_KEY_WC_TOKEN = 'hcl.WCToken';
const SESSION_KEY_WC_TRUSTED_TOKEN = 'hcl.WCTrustedToken';
const SESSION_KEY_USER_ID = 'hcl.userId';
const SESSION_KEY_IDENTITY_TYPE = 'hcl.identityType';
const SESSION_KEY_PERSONALIZATION_ID = 'hcl.personalizationID';

export class HclIdentityCapability<
  TFactory extends IdentityFactory = HclIdentityFactory,
> extends IdentityCapability<IdentityFactoryOutput<TFactory>> {
  protected config: HclConfiguration;
  protected transactionClient: HclTransactionClient;
  protected factory: IdentityFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    transactionClient: HclTransactionClient,
    factory: IdentityFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.transactionClient = transactionClient;
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

    const response = await this.transactionClient.loginIdentity(
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
    const wcTrustedToken = this.context.session[
      SESSION_KEY_WC_TRUSTED_TOKEN
    ] as string | undefined;
    const userId = this.context.session[SESSION_KEY_USER_ID] as
      | string
      | undefined;

    // Best-effort server-side logout — silently ignored if endpoint not supported
    if (wcToken && wcTrustedToken && userId) {
      try {
        await this.transactionClient.deleteLoginIdentity(userId, {
          WCToken: wcToken,
          WCTrustedToken: wcTrustedToken,
        });
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
    const guest = await this.transactionClient.createGuestIdentity();
    this.storeSessionTokens(
      guest.WCToken,
      guest.WCTrustedToken,
      guest.userId,
      'guest',
      guest.personalizationID,
    );

    // Register the person — the guest session tokens are passed as auth.
    const guestAuth = {
      WCToken: guest.WCToken,
      WCTrustedToken: guest.WCTrustedToken,
    };
    const registered = await this.transactionClient.registerPerson(
      payload.username,
      payload.password,
      guestAuth,
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
}
