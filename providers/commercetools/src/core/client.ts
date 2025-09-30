import {
  ClientBuilder,
  type TokenCache,
  type TokenCacheOptions,
  type TokenStore,
} from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { randomUUID } from 'crypto';
import {
  AnonymousIdentitySchema,
  GuestIdentitySchema,
  RegisteredIdentitySchema,
  type RequestContext,
} from '@reactionary/core';
import * as crypto from 'crypto';

export class RequestContextTokenCache implements TokenCache {
  constructor(protected context: RequestContext) {}

  public async get(
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<TokenStore | undefined> {
    const identity = this.context.identity;

    return {
      refreshToken: identity.refresh_token,
      token: identity.token || '',
      expirationTime: identity.expiry.getTime(),
    };
  }

  public async set(
    cache: TokenStore,
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<void> {
    const identity = this.context.identity;

    identity.refresh_token = cache.refreshToken;
    identity.token = cache.token;
    identity.expiry = new Date(cache.expirationTime);
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

    reqCtx.identity = RegisteredIdentitySchema.parse({
      ...reqCtx.identity,
      type: 'Registered',
      logonId: username,
      id: {
        userId: login.body.customer.id,
      },
    });

    return reqCtx.identity;
  }

  public async logout(reqCtx: RequestContext) {
    const cache = new RequestContextTokenCache(reqCtx);
    await cache.set({ token: '', refreshToken: '', expirationTime: 0 });

    reqCtx.identity = AnonymousIdentitySchema.parse({});

    // TODO: We could do token revocation here, if we wanted to. The above simply whacks the session.

    return reqCtx.identity;
  }

  protected createClient(reqCtx: RequestContext) {
    const cache = new RequestContextTokenCache(reqCtx);

    if (reqCtx.identity.type === 'Anonymous') {
      reqCtx.identity = GuestIdentitySchema.parse({
        id: {
          userId: crypto.randomUUID().toString(),
        },
        type: 'Guest',
      });
    }

    const identity = reqCtx.identity;
    let builder = this.createBaseClientBuilder();

    if (!identity.token || !identity.refresh_token) {
      builder = builder.withAnonymousSessionFlow({
        host: this.config.authUrl,
        projectKey: this.config.projectKey,
        credentials: {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          anonymousId: identity.id.userId,
        },
        tokenCache: cache,
      });
    } else {
      builder = builder.withRefreshTokenFlow({
        credentials: {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        },
        host: this.config.authUrl,
        projectKey: this.config.projectKey,
        refreshToken: identity.refresh_token || '',
        tokenCache: cache,
      });
    }

    return createApiBuilderFromCtpClient(builder.build());
  }

  protected createBaseClientBuilder() {
    const builder = new ClientBuilder()
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
      .withCorrelationIdMiddleware({
        // ideally this would be pushed in as part of the session context, so we can trace it end-to-end
        generate: () => `REACTIONARY-${randomUUID()}`,
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

    // CT's telemetry module is currently broken and consequently not included in the above (createTelemetryMiddleware)

    return builder;
  }
}
