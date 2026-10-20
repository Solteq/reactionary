import { createHmac } from 'node:crypto';

/** An agent's order webhook receiver and the secret shared with it. */
export interface ACPWebhookEndpoint {
  /** e.g. the agent's `.../agentic_checkout/webhooks/order_events` URL. */
  url: string;
  /** Shared secret for the `Merchant-Signature` HMAC. */
  secret: string;
  /**
   * The authenticated agent (see `authenticate`) whose orders go to this
   * endpoint. Endpoints without one receive orders of every agent that has
   * no endpoint of its own.
   */
  agentId?: string;
}

export interface ACPWebhookOptions {
  endpoints: ACPWebhookEndpoint[];
  /**
   * Delays before each retry of a failed delivery. Retries are held in
   * memory, so they do not survive a restart. Defaults to 0.5s, 2s, 10s, 1m
   * and 5m.
   */
  retryDelaysMs?: number[];
  /** Accepts `http:` endpoint URLs; intended for test environments. */
  allowInsecureUrls?: boolean;
  /** Fetch implementation; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export type ACPOrderEventType = 'order_create' | 'order_update';

const DEFAULT_RETRY_DELAYS_MS = [500, 2_000, 10_000, 60_000, 300_000];
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Delivers order lifecycle events to agents' webhook receivers (checkout
 * RFC §2.3), signed with `Merchant-Signature: t=<unix>,v1=<hex>` over
 * `timestamp + "." + body` (HMAC-SHA256). Failed deliveries are retried as
 * the same event, with a fresh timestamp and signature, as in the UCP
 * adapter.
 */
export class ACPOrderWebhooks {
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: ACPWebhookOptions) {
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.fetchImpl = options.fetch ?? fetch;

    for (const endpoint of options.endpoints) {
      if (!endpoint.secret || !this.isAllowedUrl(endpoint.url)) {
        throw new Error(`ACP webhook endpoint ${endpoint.url} needs an https URL and a secret.`);
      }
    }
  }

  /** The endpoint for an agent's orders, if any. */
  public getEndpoint(agentId: string | undefined): ACPWebhookEndpoint | undefined {
    return this.options.endpoints.find((endpoint) => agentId !== undefined && endpoint.agentId === agentId)
      ?? this.options.endpoints.find((endpoint) => endpoint.agentId === undefined);
  }

  /** Sends an event without waiting for it; the order is the full current state. */
  public deliver(endpoint: ACPWebhookEndpoint, type: ACPOrderEventType, order: object): void {
    const body = JSON.stringify({ type, data: order });
    const requestId = `evt_${crypto.randomUUID()}`;

    void this.attempt(endpoint, body, requestId, 0);
  }

  private async attempt(endpoint: ACPWebhookEndpoint, body: string, requestId: string, attempt: number): Promise<void> {
    let failure: string;

    try {
      const response = await this.fetchImpl(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'request-id': requestId,
          'merchant-signature': signWebhookPayload(body, endpoint.secret),
        },
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
      console.error(`ACP: giving up on webhook ${requestId} to ${endpoint.url} after ${attempt + 1} attempts: ${failure}`);
      return;
    }

    setTimeout(() => void this.attempt(endpoint, body, requestId, attempt + 1), delay).unref();
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

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`, as receivers verify. */
export function signWebhookPayload(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

  return `t=${timestamp},v1=${signature}`;
}
