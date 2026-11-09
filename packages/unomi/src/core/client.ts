import type { RequestContext } from '@reactionary/core';
import type { UnomiConfiguration } from '../schema/configuration.schema.js';

let warnedUntrusted = false;

export class UnomiAPI {
  constructor(
    protected readonly config: UnomiConfiguration,
    protected readonly _context: RequestContext,
  ) {
    // Capabilities are built per request, so the warning is given once per process. A sender that is let in by `peerKey` (Unomi 3,
    // single-tenant compatibility mode) is not untrusted, and has no use for the private key.
    if (!this.isTrusted && !this.config.peerKey && !warnedUntrusted) {
      warnedUntrusted = true;
      console.warn('Unomi is configured without privateKey: Unomi 4 files every event on a throwaway profile, refuses login merges and does not return profiles. Set tenantId and privateKey.');
    }
  }

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

  /** Whether the sender authenticates as a trusted caller. */
  public get isTrusted(): boolean {
    return this.basicCredentials() !== undefined;
  }

  /** The tenant private key, or the deprecated `password` (with `username`, or else the tenant id). Either makes the sender a trusted caller in Unomi 4. */
  protected basicCredentials(): { user: string; secret: string } | undefined {
    const { privateKey, tenantId, username, password } = this.config;
    if (privateKey) {
      return { user: tenantId, secret: privateKey };
    }
    return password ? { user: username || tenantId, secret: password } : undefined;
  }

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json' };

    const basic = this.basicCredentials();
    if (basic) {
      headers['authorization'] = `Basic ${btoa(`${basic.user}:${basic.secret}`)}`;
    }
    if (this.config.apiKey) {
      headers['x-unomi-api-key'] = this.config.apiKey;
      // A sender with an api key and no tenant credentials has always sent it as a bearer token too, which a Unomi that takes the
      // key that way (not Unomi 4) relies on. Credentials of the tenant replace it.
      if (!basic) {
        headers['authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }
    if (this.config.peerKey) {
      headers['x-unomi-peer'] = this.config.peerKey;
    }

    return headers;
  }
}
