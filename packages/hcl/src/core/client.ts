import type { RequestContext } from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import { getLocaleParams } from './locale-params.js';
import {
  SESSION_KEY_PERSONALIZATION_ID,
  SESSION_KEY_WC_TOKEN,
  SESSION_KEY_WC_TRUSTED_TOKEN,
} from './session-keys.js';

/** Thrown when the WCS server returns 404 for a cart endpoint (no active cart). */
export class HclCartNotFoundError extends Error {
  constructor() {
    super('No active cart found');
    this.name = 'HclCartNotFoundError';
  }
}

/**
 * Unified HCL Commerce HTTP client.
 *
 * Covers both the Query Service (catalog/search) and the WCS Transaction
 * Service through two base URL prefixes:
 *
 *   catalogBaseUrl     — {apiUrl}/search/resources
 *   transactionBaseUrl — {apiUrl}/wcs/resources/store/{storeId}
 *
 * Auth headers are read from the injected RequestContext on every request,
 * so capabilities never need to extract and forward session tokens manually.
 *
 * Use the generic `callGet` / `callPost` / `callPut` / `callDelete` helpers
 * in capability subclasses, passing the appropriate base URL + path, so that
 * project-level subclasses can intercept and customise individual API calls.
 */
export class HclClient {
  /** Base URL for the Query Service (catalog / search). */
  readonly catalogBaseUrl: string;

  /** Base URL for the Transaction Service (WCS REST). */
  readonly transactionBaseUrl: string;

  constructor(
    protected readonly config: HclConfiguration,
    protected readonly context: RequestContext,
  ) {
    const origin = config.apiUrl.replace(/\/+$/, '');
    this.catalogBaseUrl = `${origin}/search/resources`;
    this.transactionBaseUrl = `${origin}/wcs/resources/store/${config.storeId}`;
  }

  // ---------------------------------------------------------------------------
  // Generic HTTP helpers — auth headers are injected from context automatically.
  // Pass the full URL (catalogBaseUrl or transactionBaseUrl + path) so callers
  // are explicit about which service they are targeting.
  // ---------------------------------------------------------------------------

  async callGet<T>(url: string, params?: URLSearchParams): Promise<T>;
  async callGet<T>(
    url: string,
    params: URLSearchParams | undefined,
    opts: { allowUndefined: true },
  ): Promise<T | undefined>;
  async callGet<T>(
    url: string,
    params?: URLSearchParams,
    opts?: { allowUndefined?: boolean },
  ): Promise<T | undefined> {
    const merged = this.buildParams(params);
    const query = merged.toString() ? `?${merged.toString()}` : '';
    const response = await fetch(`${url}${query}`, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    if (opts?.allowUndefined && response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(
        `HCL GET ${url} error ${response.status} ${response.statusText}`,
      );
    }
    return response.json() as Promise<T>;
  }

  async callPost<T>(url: string, body: unknown = {}): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HCL POST ${url} error ${response.status} ${response.statusText}: ${text}`,
      );
    }
    return response.json() as Promise<T>;
  }

  async callPut<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HCL PUT ${url} error ${response.status} ${response.statusText}: ${text}`,
      );
    }
    return response.json() as Promise<T>;
  }

  async callDelete(url: string, opts?: { ignore404?: boolean }): Promise<void> {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(),
    });
    if (!response.ok && !(opts?.ignore404 && response.status === 404)) {
      throw new Error(
        `HCL DELETE ${url} error ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Merges caller-supplied params with locale defaults (langId, currency)
   * derived from the request context. Caller-supplied values always win.
   */
  protected buildParams(params?: URLSearchParams): URLSearchParams {
    const merged = new URLSearchParams(params);
    const { langId, currency } = getLocaleParams(this.config, this.context);
    if (langId && !merged.has('langId')) merged.set('langId', langId);
    if (currency && !merged.has('currency')) merged.set('currency', currency);
    return merged;
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.context.session[SESSION_KEY_WC_TOKEN] as
      | string
      | undefined;
    const trustedToken = this.context.session[SESSION_KEY_WC_TRUSTED_TOKEN] as
      | string
      | undefined;
    const personalizationId = this.context.session[
      SESSION_KEY_PERSONALIZATION_ID
    ] as string | undefined;
    if (token) headers['WCToken'] = token;
    if (trustedToken) headers['WCTrustedToken'] = trustedToken;
    if (personalizationId) headers['WCPersonalization'] = personalizationId;
    return headers;
  }
}
