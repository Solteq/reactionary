import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { signRestRequest, type UCPSigningKey } from './reactionary-ucp-signing.js';

export interface ReactionaryUCPWebhookOptions {
  /**
   * Signs deliveries; the order capability requires signed webhook payloads.
   * Without it deliveries are sent unsigned, and a warning is logged.
   */
  signingKey?: UCPSigningKey;
  /**
   * Delays before each retry of a failed delivery. Retries are held in
   * memory, so they do not survive a restart. Defaults to 0.5s, 2s, 10s, 1m
   * and 5m.
   */
  retryDelaysMs?: number[];
  /**
   * Accepts `http:` agent profile and webhook URLs. Only https URLs are
   * fetched otherwise. Intended for conformance and test environments.
   */
  allowInsecureUrls?: boolean;
  /** Fetch implementation; defaults to the global fetch. */
  fetch?: typeof fetch;
}

const DEFAULT_RETRY_DELAYS_MS = [500, 2_000, 10_000, 60_000, 300_000];
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;
const ORDER_CAPABILITY = 'dev.ucp.shopping.order';

const AgentProfileSchema = z.looseObject({
  ucp: z.looseObject({
    capabilities: z.record(z.string(), z.array(z.looseObject({
      config: z.looseObject({ webhook_url: z.string().optional() }).optional(),
    }))).optional(),
  }),
});

/**
 * Delivers order events to the webhook URL a platform declares in its
 * profile (order capability `config.webhook_url`), following Standard
 * Webhooks headers and the UCP REST signing binding.
 */
export class ReactionaryUCPWebhooks {
  private readonly profileCache = new Map<string, { webhookUrl?: string; expiresAt: number }>();
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private warnedUnsigned = false;

  public constructor(
    private readonly options: ReactionaryUCPWebhookOptions,
    /** The business profile URL, sent as the deliveries' UCP-Agent. */
    private readonly businessProfileUrl: string,
  ) {
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.fetchImpl = options.fetch ?? fetch;
  }

  /** The order webhook URL declared in a platform's profile, if any. */
  public async resolveOrderWebhookUrl(agentProfileUrl: string): Promise<string | undefined> {
    const cached = this.profileCache.get(agentProfileUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.webhookUrl;
    }

    const webhookUrl = this.isAllowedUrl(agentProfileUrl)
      ? await this.fetchOrderWebhookUrl(agentProfileUrl)
      : undefined;
    this.profileCache.set(agentProfileUrl, { webhookUrl, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });

    return webhookUrl;
  }

  /**
   * Sends an order event without waiting for it. Failed attempts are retried
   * as the same event: same Webhook-Id, Webhook-Timestamp and body.
   */
  public deliver(webhookUrl: string, order: object): void {
    if (!this.isAllowedUrl(webhookUrl)) {
      return;
    }

    const webhookId = `evt_${randomUUID()}`;
    const body = JSON.stringify(order);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      'ucp-agent': `profile="${this.businessProfileUrl}"`,
      // Deliveries are state-changing POSTs; retries keep the key.
      'idempotency-key': webhookId,
    };

    if (this.options.signingKey) {
      Object.assign(headers, signRestRequest({ method: 'POST', url: webhookUrl, headers, body }, this.options.signingKey));
    } else if (!this.warnedUnsigned) {
      this.warnedUnsigned = true;
      console.warn('UCP: order webhooks are sent unsigned; configure webhooks.signingKey (the order capability requires signed payloads).');
    }

    void this.attempt(webhookUrl, headers, body, 0);
  }

  private async attempt(
    webhookUrl: string,
    headers: Record<string, string>,
    body: string,
    attempt: number,
  ): Promise<void> {
    let failure: string;

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        return;
      }

      failure = `HTTP ${response.status}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    const delay = this.retryDelaysMs[attempt];

    if (delay === undefined) {
      console.error(`UCP: giving up on webhook ${headers['webhook-id']} to ${webhookUrl} after ${attempt + 1} attempts: ${failure}`);
      return;
    }

    setTimeout(() => void this.attempt(webhookUrl, headers, body, attempt + 1), delay).unref();
  }

  private async fetchOrderWebhookUrl(agentProfileUrl: string): Promise<string | undefined> {
    try {
      const response = await this.fetchImpl(agentProfileUrl, {
        headers: { accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const profile = response.ok ? AgentProfileSchema.safeParse(await response.json()) : undefined;
      const capabilities = profile?.success ? profile.data.ucp.capabilities?.[ORDER_CAPABILITY] ?? [] : [];

      return capabilities.find((capability) => capability.config?.webhook_url)?.config?.webhook_url;
    } catch {
      return undefined;
    }
  }

  private isAllowedUrl(value: string): boolean {
    try {
      const { protocol } = new URL(value);
      return protocol === 'https:' || (protocol === 'http:' && Boolean(this.options.allowInsecureUrls));
    } catch {
      return false;
    }
  }
}
