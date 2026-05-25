import type { RequestContext } from '@reactionary/core';
import type { BazaarvoiceConfiguration } from '../schema/configuration.schema.js';

/**
 * Thin HTTP client for the Bazaarvoice Conversations REST API.
 *
 * Handles only transport concerns — authentication params (passKey, apiVersion)
 * and locale (derived from the request context) are injected automatically on
 * every request via `buildParams` / `buildBody`.
 *
 * URL construction and request-specific parameters are the responsibility of
 * capability subclasses (extension-point pattern).
 */
export class BazaarvoiceClient {
  /** Base API URL, e.g. https://api.bazaarvoice.com */
  readonly baseUrl: string;

  constructor(
    protected readonly config: BazaarvoiceConfiguration,
    protected readonly context: RequestContext,
  ) {
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
  }

  async callGet<T>(
    url: string,
    params: URLSearchParams,
    schema: { parse(data: unknown): T },
  ): Promise<T> {
    const merged = this.buildParams(params);
    const query = merged.toString() ? `?${merged.toString()}` : '';
    const response = await fetch(`${url}${query}`);
    if (!response.ok) {
      throw new Error(
        `Bazaarvoice GET ${url} error ${response.status} ${response.statusText}`,
      );
    }
    const json: unknown = await response.json();
    return schema.parse(json);
  }

  async callPost<T>(
    url: string,
    body: URLSearchParams,
    schema: { parse(data: unknown): T },
  ): Promise<T> {
    const merged = this.buildBody(body);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: merged.toString(),
    });
    if (!response.ok) {
      throw new Error(
        `Bazaarvoice POST ${url} error ${response.status} ${response.statusText}`,
      );
    }
    const json: unknown = await response.json();
    return schema.parse(json);
  }

  /**
   * Merges caller-supplied params with the default BV params (passKey,
   * apiVersion, Locale). Caller-supplied values always win.
   */
  protected buildParams(params: URLSearchParams): URLSearchParams {
    const merged = new URLSearchParams(params);
    if (!merged.has('passKey')) merged.set('passKey', this.config.passKey);
    if (!merged.has('apiVersion'))
      merged.set('apiVersion', this.config.apiVersion);
    if (!merged.has('Locale')) merged.set('Locale', this.bvLocale());
    return merged;
  }

  /**
   * Merges caller-supplied POST body with the default BV fields (passKey,
   * apiVersion, Locale). Caller-supplied values always win.
   */
  protected buildBody(body: URLSearchParams): URLSearchParams {
    const merged = new URLSearchParams(body);
    if (!merged.has('passKey')) merged.set('passKey', this.config.passKey);
    if (!merged.has('apiVersion'))
      merged.set('apiVersion', this.config.apiVersion);
    if (!merged.has('Locale')) merged.set('Locale', this.bvLocale());
    return merged;
  }

  /**
   * Converts a BCP 47 locale (e.g. `en-US`) to BV's expected `en_US` format.
   */
  protected bvLocale(): string {
    return this.context.languageContext.locale.replace('-', '_');
  }
}
