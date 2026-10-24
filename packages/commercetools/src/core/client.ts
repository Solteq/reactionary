import { ClientBuilder, type Middleware } from '@commercetools/ts-client';
import {
  createApiBuilderFromCtpClient,
  type ApiRoot,
  type ByProjectKeyBusinessUnitsKeyByKeyAssociatesByAssociateIdRequestBuilder,
} from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { randomUUID } from 'crypto';
import {
  AnonymousIdentitySchema,
  RegisteredIdentitySchema,
  type AnonymousIdentity,
  type CompanyIdentifier,
  type GuestIdentity,
  type RegisteredIdentity,
  type RequestContext,
} from '@reactionary/core';
import * as crypto from 'crypto';
import createDebug from 'debug';
import {
  refreshTokens,
  resolveMetadata,
  type ExternalIdentityProvider,
  type OidcTokens,
} from '@reactionary/oidc';
import { RequestContextTokenCache } from './token-cache.js';
import {
  CommercetoolsSessionSchema,
  type CommercetoolsSession,
} from '../schema/session.schema.js';
import {
  CommercetoolsAccessTokenSchema,
  CommercetoolsTokenIntrospectionSchema,
} from '../schema/oauth.schema.js';
const debug = createDebug('reactionary:commercetools');

export const PROVIDER_SESSION_KEY = 'COMMERCETOOLS_PROVIDER';

/** One minute before the identity provider says the access token expires; falls back to five minutes. */
function externalExpiration(expiresIn: number | undefined): number {
  return Date.now() + (expiresIn ?? 300) * 1000 - 60 * 1000;
}

function isDuplicateEmail(err: unknown): boolean {
  const errors = (err as { body?: { errors?: Array<{ code?: string; field?: string }> } } | undefined)?.body?.errors;
  return Boolean(errors?.some((e) => e.code === 'DuplicateField' && e.field === 'email'));
}


export class CommercetoolsAPI {
  protected config: CommercetoolsConfiguration;
  protected context: RequestContext;
  protected tokenCache: RequestContextTokenCache;
  protected client: Promise<ApiRoot> | undefined;
  protected adminClient: Promise<ApiRoot> | undefined;


  constructor(config: CommercetoolsConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;
    this.tokenCache = new RequestContextTokenCache(
      this.context,
      PROVIDER_SESSION_KEY,
    );
  }

  public async getClient() {
    if (!this.client) {
      this.client = this.createClient();
    }

    return this.client;
  }

  public async getClientForCompany(company: { taxIdentifier: string }) {
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      throw new Error('Only registered identities can have company clients');
    }

    const companyClient = (await this.getAdminClient())
      .withProjectKey({ projectKey: this.config.projectKey })
      .asAssociate()
      .withAssociateIdValue({
        associateId: this.context.session.identityContext.identity.id.userId,
      })
      .inBusinessUnitKeyWithBusinessUnitKeyValue({
        businessUnitKey: company.taxIdentifier,
      });
    return companyClient;
  }

  public async getAdminClient() {
    if (!this.adminClient) {
      this.adminClient = this.createAdminClient();
    }

    return this.adminClient;
  }

  public getSessionData(): CommercetoolsSession {
    return this.context.session[PROVIDER_SESSION_KEY]
      ? (this.context.session[PROVIDER_SESSION_KEY] as CommercetoolsSession)
      : CommercetoolsSessionSchema.parse({});
  }

  public setSessionData(sessionData: Partial<CommercetoolsSession>): void {
    const existingData = this.context.session[
      PROVIDER_SESSION_KEY
    ] as Partial<CommercetoolsSession>;

    this.context.session[PROVIDER_SESSION_KEY] = {
      ...existingData,
      ...sessionData,
    };
  }

  /**
   * Only caches it pr session for now...... but still better than every call
   * @param key
   * @returns
   */
  public async resolveChannelIdByKey(key: string): Promise<string> {
    const sessionData = this.getSessionData();

    const cacheKey = `___channel_${key}`;
    const cachedValue = sessionData[cacheKey];
    if (cachedValue) {
      if (debug.enabled) {
        debug(`Resolved channel ${key} from cache`);
      }
      return cachedValue + '';
    }

    const client = await this.getAdminClient();
    const response = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .channels()
      .withKey({ key: key })
      .get()
      .execute();

    const channel = response.body;
    this.setSessionData({
      [cacheKey]: channel.id,
    });
    if (debug.enabled) {
      debug(`Resolved channel ${key} from API and cached it`);
    }

    return channel.id;
  }

  /**
   * Only caches it pr session for now...... but still better than every call
   * @param key
   * @returns
   */
  public async resolveChannelIdByRole(role: string): Promise<string> {
    const sessionData = this.getSessionData();

    const cacheKey = `___channel_role_${role}`;
    const cachedValue = sessionData[cacheKey];
    if (cachedValue) {
      if (debug.enabled) {
        debug(`Resolved channel ${role} from cache`);
      }
      return cachedValue + '';
    }

    const client = await this.getAdminClient();
    const response = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .channels()
      .get({
        queryArgs: {
          where: `roles contains any (:role)`,
          'var.role': role,
        },
      })
      .execute();

    const channels = response.body;
    if (channels.results.length === 0) {
      throw new Error(`No channel found with role ${role}`);
    }

    const channel = channels.results[0];
    this.setSessionData({
      [cacheKey]: channel.id,
    });

    if (debug.enabled) {
      debug(`Resolved channel ${role} from API and cached it`);
    }

    return channel.id;
  }

  protected async createAdminClient() {
    let builder = this.createBaseClientBuilder();
    builder = builder.withAnonymousSessionFlow({
      credentials: {
        clientId: this.config.adminClientId || this.config.clientId,
        clientSecret: this.config.adminClientSecret || this.config.clientSecret,
      },
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
    });

    return createApiBuilderFromCtpClient(builder.build());
  }

  protected async createClient() {
    const external = this.getSessionData();
    if (external.tokenSource === 'external' && external.externalProvider) {
      return createApiBuilderFromCtpClient(
        this.createBaseClientBuilder()
          .withMiddleware(this.externalAuthMiddleware(external.externalProvider))
          .build(),
      );
    }

    let session = await this.tokenCache.get();
    const isNewSession = !session || !session.refreshToken;

    if (isNewSession) {
      await this.becomeGuest();

      session = await this.tokenCache.get();
    }

    let builder = this.createBaseClientBuilder();
    builder = builder.withRefreshTokenFlow({
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      refreshToken: session?.refreshToken || '',
      tokenCache: this.tokenCache,
    });

    return createApiBuilderFromCtpClient(builder.build());
  }

  public async register(username: string, password: string) {
    const registrationBuilder =
      this.createBaseClientBuilder().withAnonymousSessionFlow({
        host: this.config.authUrl,
        projectKey: this.config.projectKey,
        credentials: {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        },
        scopes: this.config.scopes,
      });

    const registrationClient = createApiBuilderFromCtpClient(
      registrationBuilder.build(),
    );

    const registration = await registrationClient
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .signup()
      .post({
        body: {
          email: username,
          password: password,
        },
      })
      .execute();

    const login = await this.login(username, password);

    return login;
  }

  public async login(username: string, password: string) {
    if (this.getSessionData().tokenSource === 'external') {
      this.clearExternalSession();
    }
    const loginBuilder = this.createBaseClientBuilder().withPasswordFlow({
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        user: { username, password },
      },
      tokenCache: this.tokenCache,
      scopes: this.config.scopes,
    });

    const loginClient = createApiBuilderFromCtpClient(loginBuilder.build());

    const login = await loginClient
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .login()
      .post({
        body: {
          email: username,
          password: password,
        },
      })
      .execute();

    const self = await loginClient
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .get({})
      .execute();

    return RegisteredIdentitySchema.parse({
      type: 'Registered',
      id: {
        userId: self.body.id,
      },
    });
  }

  public async logout() {
    await this.tokenCache.set({
      token: '',
      refreshToken: '',
      expirationTime: 0,
    });
    this.clearExternalSession();

    // TODO: We could do token revocation here, if we wanted to. The above simply whacks the session.
    const identity = {
      type: 'Anonymous',
    } satisfies AnonymousIdentity;
    return identity;
  }

  public async introspect(): Promise<
    AnonymousIdentity | GuestIdentity | RegisteredIdentity
  > {
    const session = await this.tokenCache.get();

    if (!session || !session.token) {
      const identity = {
        type: 'Anonymous',
      } satisfies AnonymousIdentity;

      return identity;
    }

    // commercetools' own introspection does not know an identity provider's token, so an external session is
    // judged by its stored customer and whether its token is still good or can be refreshed.
    const sessionData = this.getSessionData();
    if (sessionData.tokenSource === 'external') {
      return this.introspectExternalSession(sessionData);
    }

    let body = await this.introspectToken(session.token);

    // The access token is short-lived, so it may have expired while the session (refresh token) is still valid
    if (body && !body.active && session.refreshToken) {
      const refreshedToken = await this.refreshAccessToken(session.refreshToken);
      if (refreshedToken) {
        body = await this.introspectToken(refreshedToken);
      }
    }

    if (!body) {
      return AnonymousIdentitySchema.parse({});
    }

    const scopes: string = body.scope + '';

    // FIXME: Map unmapped user_id...
    if (scopes.indexOf('anonymous_id') > -1) {
      const s = scopes.split(' ');
      const idScope = s.find((x) => x.startsWith('anonymous_id'));
      const id = idScope?.split(':')[1] || '';
      const identity = {
        id: {
          userId: id,
        },
        type: 'Guest',
      } satisfies GuestIdentity;

      return identity;
    }

    // FIXME: Map unmapped user_id...
    if (scopes.indexOf('customer_id') > -1) {
      const s = scopes.split(' ');
      const idScope = s.find((x: any) => x.startsWith('customer_id'));
      const id = idScope?.split(':')[1] || '';
      const identity = {
        id: {
          userId: id,
        },
        type: 'Registered',
      } satisfies RegisteredIdentity;

      return identity;
    }

    return {
      type: 'Anonymous',
    } satisfies AnonymousIdentity;
  }

  protected getBasicAuthHeader() {
    return (
      'Basic ' +
      Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`,
      ).toString('base64')
    );
  }

  protected async introspectToken(token: string) {
    const response = await fetch(`${this.config.authUrl}/oauth/introspect`, {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token,
      }),
    });

    const result = CommercetoolsTokenIntrospectionSchema.safeParse(await response.json());
    return result.success ? result.data : undefined;
  }

  /**
   * Exchanges the refresh token for a new access token and stores it in the token cache.
   * Returns the new access token, or undefined if the refresh token is no longer valid.
   */
  protected async refreshAccessToken(refreshToken: string): Promise<string | undefined> {
    const response = await fetch(`${this.config.authUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return undefined;
    }

    const parsed = CommercetoolsAccessTokenSchema.safeParse(await response.json());
    if (!parsed.success) {
      return undefined;
    }
    const result = parsed.data;

    await this.tokenCache.set({
      expirationTime: Date.now() + result.expires_in * 1000 - 5 * 60 * 1000,
      token: result.access_token,
      refreshToken,
    });

    return result.access_token;
  }

  /**
   * Signs in a verified external identity. The customer is found by externalId (<iss>|<sub>); a customer with the
   * same email but another externalId is reported as a conflict rather than linked. The shopper's guest cart goes
   * with them. The identity provider's access token becomes the session token, which commercetools accepts
   * through the project's externalOAuth introspection endpoint.
   */
  public async loginWithExternalIdentity(input: {
    provider: ExternalIdentityProvider;
    externalId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tokens: OidcTokens & { accessToken: string };
  }): Promise<{ type: 'Registered'; customerId: string } | { type: 'Conflict'; message: string }> {
    const admin = (await this.getAdminClient()).withProjectKey({
      projectKey: this.config.projectKey,
    });
    const guestId = await this.currentGuestId();

    const existing = (
      await admin
        .customers()
        .get({ queryArgs: { where: 'externalId = :e', 'var.e': input.externalId, limit: 1 } })
        .execute()
    ).body.results[0];

    let customerId = existing?.id;
    if (customerId) {
      if (guestId) {
        await this.assignGuestCarts(guestId, customerId);
      }
    } else {
      const sameEmail = (
        await admin
          .customers()
          .get({
            queryArgs: {
              where: 'email in (:a, :b)',
              'var.a': input.email,
              'var.b': input.email.toLowerCase(),
              limit: 1,
            },
          })
          .execute()
      ).body.results[0];
      if (sameEmail) {
        return { type: 'Conflict', message: 'A customer with this email address already exists' };
      }

      try {
        const created = await admin
          .customers()
          .post({
            body: {
              email: input.email,
              externalId: input.externalId,
              authenticationMode: 'ExternalAuth',
              isEmailVerified: true,
              ...(input.firstName ? { firstName: input.firstName } : {}),
              ...(input.lastName ? { lastName: input.lastName } : {}),
              // Assigns the guest's carts to the new customer
              ...(guestId ? { anonymousId: guestId } : {}),
            },
          })
          .execute();
        customerId = created.body.customer.id;
      } catch (err) {
        // commercetools keeps emails unique regardless of case, which the lookup above can miss
        if (isDuplicateEmail(err)) {
          return { type: 'Conflict', message: 'A customer with this email address already exists' };
        }
        throw err;
      }
    }

    await this.tokenCache.set({
      token: input.tokens.accessToken,
      refreshToken: input.tokens.refreshToken,
      expirationTime: externalExpiration(input.tokens.expiresIn),
    });
    this.setSessionData({
      tokenSource: 'external',
      externalProvider: input.provider.key,
      customerId,
    });
    // The memoized client was built for the guest session
    this.client = undefined;

    return { type: 'Registered', customerId };
  }

  /** The anonymous id of the current guest session, if there is one. */
  protected async currentGuestId(): Promise<string | undefined> {
    try {
      const identity = await this.introspect();
      return identity.type === 'Guest' ? identity.id.userId : undefined;
    } catch (err) {
      debug('Could not read the guest session before external login: %o', err);
      return undefined;
    }
  }

  /** Hands a guest's active carts to a customer that already existed. */
  protected async assignGuestCarts(anonymousId: string, customerId: string): Promise<void> {
    const admin = (await this.getAdminClient()).withProjectKey({
      projectKey: this.config.projectKey,
    });
    const carts = await admin
      .carts()
      .get({
        queryArgs: {
          where: 'anonymousId = :a and cartState = "Active"',
          'var.a': anonymousId,
        },
      })
      .execute();
    for (const cart of carts.body.results) {
      await admin
        .carts()
        .withId({ ID: cart.id })
        .post({
          body: { version: cart.version, actions: [{ action: 'setCustomerId', customerId }] },
        })
        .execute();
    }
  }

  /** Adds the external session's access token to every request, refreshing it through the identity provider first when it has expired. */
  protected externalAuthMiddleware(providerKey: string): Middleware {
    return (next) => async (request) => {
      const token = await this.currentExternalAccessToken(providerKey);
      return next({
        ...request,
        headers: { ...request.headers, Authorization: `Bearer ${token}` },
      });
    };
  }

  protected async currentExternalAccessToken(providerKey: string): Promise<string> {
    const session = await this.tokenCache.get();
    if (session?.token && session.expirationTime > Date.now()) {
      return session.token;
    }

    const provider = this.config.externalIdentityProviders?.find((candidate) => candidate.key === providerKey);
    if (!provider || !session?.refreshToken) {
      this.clearExternalSession();
      throw new Error('The external login has expired, sign in again');
    }

    try {
      const refreshed = await refreshTokens(provider, await resolveMetadata(provider), session.refreshToken);
      await this.tokenCache.set({
        token: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
        expirationTime: externalExpiration(refreshed.expiresIn),
      });
      return refreshed.accessToken;
    } catch (err) {
      debug('Refreshing the external login failed: %o', err);
      this.clearExternalSession();
      throw new Error('The external login has expired, sign in again');
    }
  }

  protected async introspectExternalSession(
    session: CommercetoolsSession,
  ): Promise<AnonymousIdentity | RegisteredIdentity> {
    if (!session.customerId || !session.externalProvider) {
      return { type: 'Anonymous' } satisfies AnonymousIdentity;
    }
    try {
      await this.currentExternalAccessToken(session.externalProvider);
    } catch {
      return { type: 'Anonymous' } satisfies AnonymousIdentity;
    }
    return { type: 'Registered', id: { userId: session.customerId } } satisfies RegisteredIdentity;
  }

  /** Forgets that the session belongs to an external login, and the client built for it. */
  protected clearExternalSession(): void {
    const data = this.context.session[PROVIDER_SESSION_KEY] as Partial<CommercetoolsSession> | undefined;
    if (data) {
      delete data.tokenSource;
      delete data.externalProvider;
      delete data.customerId;
    }
    this.client = undefined;
  }

  protected async becomeGuest() {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    // FIXME: Missing scope-down from .test.env scopes list
    const response = await fetch(
      `${this.config.authUrl}/oauth/${this.config.projectKey}/anonymous/token?grant_type=client_credentials`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      },
    );

    const result: any = await response.json();

    this.tokenCache.set({
      expirationTime:
        Date.now() + Number(result.expires_in) * 1000 - 5 * 60 * 1000,
      token: result.access_token,
      refreshToken: result.refresh_token,
    });
  }

  protected createBaseClientBuilder() {
    let builder = new ClientBuilder()
      .withProjectKey(this.config.projectKey)
      .withQueueMiddleware({
        concurrency: 20,
      })
      .withConcurrentModificationMiddleware({
        concurrentModificationHandlerFn: (version: number, request: any) => {
          // We basically ignore concurrency issues for now.
          // And yes, ideally the frontend would handle this, but as the customer is not really in a position to DO anything about it,
          // we might as well just deal with it here.....

          console.log(
            `Concurrent modification error, retry with version ${version}`,
          );
          const body = request.body as Record<string, any>;
          body['version'] = version;
          return Promise.resolve(body);
        },
      })
      .withHttpMiddleware({
        retryConfig: {
          backoff: true,
          maxRetries: 3,
          retryDelay: 500,
          retryOnAbort: true,
          retryCodes: [500, 429, 420],
          maxDelay: 5000,
        },
        enableRetry: true,
        includeResponseHeaders: true,
        maskSensitiveHeaderData: false,
        host: this.config.apiUrl,
        httpClient: fetch,
      });

    const correlationId =
      this.context.correlationId ||
      'REACTIONARY-' +
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : randomUUID());
    builder = builder.withCorrelationIdMiddleware({
      generate: () => correlationId,
    });

    // Note:

    // CT's telemetry module is currently broken and consequently not included in the above (createTelemetryMiddleware)
    if (debug.enabled) {
      builder = builder.withLoggerMiddleware();
    }
    return builder;
  }
}
