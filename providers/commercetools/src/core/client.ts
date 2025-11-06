import {
  ClientBuilder,
  type TokenCache,
  type TokenCacheOptions,
  type TokenStore,
} from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { randomUUID } from 'crypto';
import {
  AnonymousIdentitySchema,
  GuestIdentitySchema,
  RegisteredIdentitySchema,
  type AnonymousIdentity,
  type GuestIdentity,
  type RegisteredIdentity,
  type RequestContext,
} from '@reactionary/core';
import * as crypto from 'crypto';
import createDebug from 'debug';
import { CommercetoolsSessionSchema } from '../schema/session.schema.js';
const debug = createDebug('reactionary:commercetools');

export class RequestContextTokenCache implements TokenCache {
  constructor(protected context: RequestContext) {}

  public async get(
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<TokenStore | undefined> {
    const session = CommercetoolsSessionSchema.parse(
      this.context.session['PROVIDER_COMMERCETOOLS'] || {}
    );

    if (!session) {
      return {
        refreshToken: undefined,
        token: '',
        expirationTime: new Date().getTime(),
      };
    }

    return {
      refreshToken: session.refreshToken,
      token: session.token,
      expirationTime: session.expirationTime,
    };
  }

  public async set(
    cache: TokenStore,
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<void> {
    const session = CommercetoolsSessionSchema.parse(
      this.context.session['PROVIDER_COMMERCETOOLS'] || {}
    );

    this.context.session['PROVIDER_COMMERCETOOLS'] = session;

    session.refreshToken = cache.refreshToken;
    session.token = cache.token;
    session.expirationTime = cache.expirationTime;
  }
}

export class CommercetoolsClient {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration) {
    this.config = config;
  }

  public async getClient(reqCtx: RequestContext) {
    return this.createClient(reqCtx);
  }

  public async register(
    username: string,
    password: string,
    reqCtx: RequestContext
  ) {
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
      registrationBuilder.build()
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

    const login = await this.login(username, password, reqCtx);

    return login;
  }

  public async login(
    username: string,
    password: string,
    reqCtx: RequestContext
  ) {
    const cache = new RequestContextTokenCache(reqCtx);

    const loginBuilder = this.createBaseClientBuilder().withPasswordFlow({
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        user: { username, password },
      },
      tokenCache: cache,
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

    return RegisteredIdentitySchema.parse({
      type: 'Registered',
      id: {
        userId: login.body.customer.id,
      },
    });
  }

  public async logout(reqCtx: RequestContext) {
    const cache = new RequestContextTokenCache(reqCtx);
    await cache.set({ token: '', refreshToken: '', expirationTime: 0 });

    // TODO: We could do token revocation here, if we wanted to. The above simply whacks the session.

    return AnonymousIdentitySchema.parse({});
  }

  public async introspect(
    reqCtx: RequestContext
  ): Promise<AnonymousIdentity | GuestIdentity | RegisteredIdentity> {
    const session = CommercetoolsSessionSchema.parse(
      reqCtx.session['PROVIDER_COMMERCETOOLS'] || {}
    );

    if (!session.token) {
      return AnonymousIdentitySchema.parse({});
    }

    const authHeader =
      'Basic ' +
      Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
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

    const body = await response.json();
    const scopes = body.scope;

    if (scopes.indexOf('anonymous_id') > -1) {
      return GuestIdentitySchema.parse({});
    }

    if (scopes.indexOf('customer_id') > -1) {
      return RegisteredIdentitySchema.parse({});
    }

    return AnonymousIdentitySchema.parse({});
  }

  protected async becomeGuest(cache: RequestContextTokenCache) {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

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
      }
    );

    const result = await response.json();

    cache.set({
      expirationTime: new Date().getTime() + Number(result.expires_in),
      token: result.access_token,
      refreshToken: result.refresh_token,
    });
  }

  protected async createClient(reqCtx: RequestContext) {
    const cache = new RequestContextTokenCache(reqCtx);
    let session = await cache.get();
    const isNewSession = !session || session.token.length === 0;

    if (isNewSession) {
      await this.becomeGuest(cache);

      session = await cache.get();
    }

    let builder = this.createBaseClientBuilder(reqCtx);
    builder = builder.withRefreshTokenFlow({
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      refreshToken: session!.refreshToken || '',
      tokenCache: cache,
    });

    return createApiBuilderFromCtpClient(builder.build());
  }

  protected createBaseClientBuilder(reqCtx?: RequestContext) {
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
            `Concurrent modification error, retry with version ${version}`
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
      reqCtx?.correlationId ||
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
