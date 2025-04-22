import { CommercetoolsConfig } from './configuration';
import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

const ANONYMOUS_SCOPES = [
  'view_published_products',
  'view_products',
  'manage_my_profile',
];

export class CommercetoolsClient {
  protected config: CommercetoolsConfig;

  constructor(config: CommercetoolsConfig) {
    this.config = config;
  }

  public createAnonymousClient() {
    const scopes = ANONYMOUS_SCOPES.map(
      (scope) => `${scope}:${this.config.projectKey}`
    ).join(' ');
    const builder = this.createBaseClientBuilder().withClientCredentialsFlow({
      host: this.config.authUrl,
      projectKey: this.config.projectKey,
      credentials: {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
      scopes: [scopes],
    });

    return createApiBuilderFromCtpClient(builder.build());
  }

  protected createBaseClientBuilder() {
    const builder = new ClientBuilder()
      .withProjectKey(this.config.projectKey)
      .withQueueMiddleware({
        concurrency: 20,
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

    return builder;
  }
}
