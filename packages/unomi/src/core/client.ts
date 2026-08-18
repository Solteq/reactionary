import type { RequestContext } from '@reactionary/core';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';

export class UnomiAPI {
  constructor(
    protected readonly config: UnomiConfiguration,
    protected readonly _context: RequestContext,
  ) {}

  public async getProfile(profileId: string): Promise<Response> {
    return fetch(this.getProfileUrl(profileId), {
      headers: this.getHeaders(),
    });
  }

  public async postEvent(body: Record<string, unknown>): Promise<Response> {
    return fetch(this.getEventsUrl(), {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  protected getProfileUrl(profileId: string): string {
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const profilePath = this.config.profilePath.replace(/^\/|\/$/g, '');
    return `${baseUrl}/${profilePath}/${encodeURIComponent(profileId)}`;
  }

  protected getEventsUrl(): string {
    return `${this.config.apiUrl.replace(/\/$/, '')}/cxs/context.json`;
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json' };

    if (this.config.apiKey) {
      headers['authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.username && this.config.password) {
      headers['authorization'] = `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`;
    }

    return headers;
  }
}
