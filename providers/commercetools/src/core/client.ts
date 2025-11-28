import { ClientBuilder } from '@commercetools/ts-client';
import {
  createApiBuilderFromCtpClient,
  type ApiRoot,
} from '@commercetools/platform-sdk';
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
import { RequestContextTokenCache } from './token-cache.js';
const debug = createDebug('reactionary:commercetools');

export class CommercetoolsClient {
  protected config: CommercetoolsConfiguration;
  protected context: RequestContext;
  protected cache: RequestContextTokenCache;
  protected client: Promise<ApiRoot> | undefined;
  protected adminClient: Promise<ApiRoot> | undefined;

  constructor(config: CommercetoolsConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;
    this.cache = new RequestContextTokenCache(this.context);
  }

  public async getClient() {
    if (!this.client) {
      this.client = this.createClient();
    }

    return this.client;
  }

  public async getAdminClient() {
    if (!this.adminClient) {
      this.adminClient = this.createAdminClient();
    }

    return this.adminClient;
  }

  protected async createAdminClient() {
    let builder = this.createBaseClientBuilder();
    builder = builder.withAnonymousSessionFlow({
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
    });

    return createApiBuilderFromCtpClient(builder.build());
  }

  protected async createClient() {
    let session = await this.cache.get();
    const isNewSession = !session || !session.refreshToken;

    if (isNewSession) {
      await this.becomeGuest();

      session = await this.cache.get();
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
      tokenCache: this.cache,
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
      tokenCache: this.cache,
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
    await this.cache.set({ token: '', refreshToken: '', expirationTime: 0 });

    // TODO: We could do token revocation here, if we wanted to. The above simply whacks the session.

    return AnonymousIdentitySchema.parse({});
  }

  public async introspect(): Promise<
    AnonymousIdentity | GuestIdentity | RegisteredIdentity
  > {
    const session = await this.cache.get();

    if (!session || !session.token) {
      const identity = {
        meta: {
          cache: {
            hit: false,
            key: '',
          },
          placeholder: false,
        },
        type: 'Anonymous'
      } satisfies AnonymousIdentity;

      return identity;
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

    const scopes = body.scope as string;

    if (scopes.indexOf('anonymous_id') > -1) {
      const s = scopes.split(' ');
      const idScope = s.find((x) => x.startsWith('anonymous_id'));
      const id = idScope?.split(':')[1] || '';
      const identity = {
        id: {
          userId: id,
        },
        type: 'Guest',
        meta: {
          cache: {
            hit: false,
            key: id,
          },
          placeholder: false,
        },
      } satisfies GuestIdentity;

      return identity;
    }

    if (scopes.indexOf('customer_id') > -1) {
      const s = scopes.split(' ');
      const idScope = s.find((x) => x.startsWith('customer_id'));
      const id = idScope?.split(':')[1] || '';
      const identity = {
        id: {
          userId: id,
        },
        type: 'Registered',
        meta: {
          cache: {
            hit: false,
            key: id,
          },
          placeholder: false,
        },
      } satisfies RegisteredIdentity;

      return identity;
    }

    return AnonymousIdentitySchema.parse({});
  }

  protected async becomeGuest() {
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

    this.cache.set({
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
