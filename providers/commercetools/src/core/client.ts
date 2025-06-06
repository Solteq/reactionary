import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { Session } from '@reactionary/core';

const ANONYMOUS_SCOPES = ['view_published_products', 'manage_shopping_lists', 'view_shipping_methods', 'manage_customers', 'view_product_selections', 'view_categories', 'view_project_settings', 'manage_order_edits', 'view_sessions', 'view_standalone_prices', 'manage_orders', 'view_tax_categories', 'view_cart_discounts', 'view_discount_codes', 'create_anonymous_token', 'manage_sessions', 'view_products', 'view_types'];
const GUEST_SCOPES = [...ANONYMOUS_SCOPES];
const REGISTERED_SCOPES = [...GUEST_SCOPES];

export class CommercetoolsClient {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration) {
    this.config = config;
  }

  public getClient(token?: string) {
    if (token) {
      return this.createClientWithToken(token);
    }

    return this.createAnonymousClient();
  }

  public async login(username: string, password: string) {
    const scopes = REGISTERED_SCOPES.map(
      (scope) => `${scope}:${this.config.projectKey}`
    ).join(' ');
    const queryParams = new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password,
      scope: scopes,
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
    const scopes = GUEST_SCOPES.map(
      (scope) => `${scope}:${this.config.projectKey}`
    ).join(' ');
    const queryParams = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: scopes,
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

  protected createClientWithToken(token: string) {
    const builder = this.createBaseClientBuilder().withExistingTokenFlow(`Bearer ${ token }`, { force: true });

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
