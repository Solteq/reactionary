import { ClientBuilder } from '@commercetools/ts-client';
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
import { RequestContextTokenCache } from './token-cache.js';
import {
  CommercetoolsSessionSchema,
  type CommercetoolsSession,
} from '../schema/session.schema.js';
const debug = createDebug('reactionary:commercetools');

export const PROVIDER_SESSION_KEY = 'COMMERCETOOLS_PROVIDER';

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
      cacheKey: channel.id,
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

    // TODO: We could do token revocation here, if we wanted to. The above simply whacks the session.
    const identity = {
      type: 'Anonymous',
    } satisfies AnonymousIdentity;
    return identity;
  }

  // FIXME: This can fail if the short-lived access token has expired. In other words, probably missing a token refresh.
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

    const authHeader =
      'Basic ' +
      Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`,
      ).toString('base64');
    const introspectionUrl = `${this.config.authUrl}/oauth/introspect`;

    const response = await fetch(introspectionUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: session.token,
      }),
    });

    const body: any = await response.json();
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

  protected async becomeGuest() {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    // FIXME: Missing scope-down from .env scopes list
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
