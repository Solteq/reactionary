import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { randomUUID } from 'crypto';
import type { RequestContext} from '@reactionary/core';
import { Session } from '@reactionary/core';

export class CommercetoolsClient {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration) {
    this.config = config;
  }


  // FIXME: Add token cache as bridge between Identity and WithRefreshToken flow
  public async getClient(reqCtx:  RequestContext) {

    let token = reqCtx.identity.token;

    if (!token) {
      const guestTokenResponse = await this.guest();
      if (guestTokenResponse.access_token) {
        reqCtx.identity.token = guestTokenResponse.access_token;
        reqCtx.identity.logonId = '';
        reqCtx.identity.expiry = new Date(new Date().getTime() + guestTokenResponse.expires_in * 1000);
        reqCtx.identity.refresh_token = guestTokenResponse.refresh_token;
        token = guestTokenResponse.access_token;
      }
    }


    if (token) {
      return this.createClientWithToken(token);
    } else {
      throw new Error('Could not obtain guest token');
    }
  }

  public async login(username: string, password: string) {
    const queryParams = new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password,
    });
    const url = `${this.config.authUrl}/oauth/${
      this.config.projectKey
    }/customers/token?${queryParams.toString()}`;
    const headers = {
      Authorization:
        'Basic ' + btoa(this.config.clientId + ':' + this.config.clientSecret),
    };

    const remote = await fetch(url, { method: 'POST', headers });
    const json = await remote.json();

    return json;
  }

  public async guest() {
    const queryParams = new URLSearchParams({
      grant_type: 'client_credentials',
    });
    const url = `${this.config.authUrl}/oauth/${
      this.config.projectKey
    }/anonymous/token?${queryParams.toString()}`;
    const headers = {
      Authorization:
        'Basic ' + btoa(this.config.clientId + ':' + this.config.clientSecret),
    };

    const remote = await fetch(url, { method: 'POST', headers });
    const json = await remote.json();

    return json;
  }

  public async logout(token: string) {
    const queryParams = new URLSearchParams({
      token: token,
      token_type_hint: 'access_token',
    });
    const url = `${
      this.config.authUrl
    }/oauth/token/revoke?${queryParams.toString()}`;
    const headers = {
      Authorization:
        'Basic ' + btoa(this.config.clientId + ':' + this.config.clientSecret),
    };

    const remote = await fetch(url, { method: 'POST', headers });

    return remote;
  }

  public async introspect(token: string) {
    const queryParams = new URLSearchParams({
      token,
    });
    const url = `${this.config.authUrl}/oauth/introspect?` + queryParams;
    const headers = {
      Authorization:
        'Basic ' + btoa(this.config.clientId + ':' + this.config.clientSecret),
    };

    const remote = await fetch(url, { method: 'POST', headers });
    const json = await remote.json();

    return json;
  }

  /**
   * This should be a SPA level access client..... suitable for anonymous access, like for bots or crawlers.
   * @returns
   */
  public createAnonymousClient() {
    const scopes = this.config.scopes;
    const builder = this.createBaseClientBuilder().withClientCredentialsFlow({
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
      scopes: [...scopes],
    });

    return createApiBuilderFromCtpClient(builder.build());
  }


  protected createClientWithToken(token: string) {
    const builder = this.createBaseClientBuilder().withExistingTokenFlow(
      `Bearer ${token}`,
      { force: true }
    );

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

          console.log(`Concurrent modification error, retry with version ${version}`);
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



