import type { RequestContext } from '@reactionary/core';
import type { LipscoreConfiguration } from '../schema/configuration.schema.js';

export class LipscoreClient {
  readonly baseUrl: string;

  constructor(
    protected readonly config: LipscoreConfiguration,
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
    const response = await fetch(`${url}${query}`, {
      headers: this.buildHeaders(),
    });
    if (!response.ok) {
      throw new Error(
        `Lipscore GET ${url} error ${response.status} ${response.statusText}`,
      );
    }
    const json: unknown = await response.json();
    return schema.parse(json);
  }

  protected buildParams(params: URLSearchParams): URLSearchParams {
    const merged = new URLSearchParams(params);
    if (!merged.has('api_key')) merged.set('api_key', this.config.apiKey);
    return merged;
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.apiSecret) {
      headers['X-Authorization'] = this.config.apiSecret;
    }
    return headers;
  }
}
