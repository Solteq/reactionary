import { randomUUID } from 'node:crypto';
import { lookup, type LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
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
  /**
   * Accepts agent profile and webhook URLs that point at loopback, private,
   * link-local or otherwise non-public addresses. By default these are
   * refused, because the profile URL comes from an unauthenticated request
   * header and the webhook URL from the profile it serves (server-side
   * request forgery). Intended for local development, e.g. a receiver on
   * localhost.
   */
  allowPrivateNetworks?: boolean;
  /**
   * Further restricts which agent profile and webhook URLs are used, e.g. to
   * an allowlist of known platforms. Runs after the built-in checks and can
   * only refuse URLs, not admit ones they refused.
   */
  validateUrl?: (url: URL) => boolean | Promise<boolean>;
  /**
   * Largest accepted response body, in bytes. Larger responses, such as an
   * oversized agent profile, are dropped. Defaults to 256 KiB.
   */
  maxResponseBytes?: number;
  /**
   * Most agent profiles kept in the profile cache; the least recently used
   * are evicted first. Defaults to 500.
   */
  profileCacheMaxEntries?: number;
  /**
   * Fetch implementation. Defaults to a built-in transport that refuses to
   * connect to non-public addresses at connect time, which also defeats DNS
   * rebinding. It connects directly and ignores HTTP(S)_PROXY; behind an
   * egress proxy, supply a fetch that uses it. A custom fetch replaces the
   * built-in transport, and with it the connect-time check; only URLs naming
   * a non-public IP address or localhost are then refused up front.
   */
  fetch?: typeof fetch;
}

const DEFAULT_RETRY_DELAYS_MS = [500, 2_000, 10_000, 60_000, 300_000];
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const DEFAULT_PROFILE_CACHE_MAX_ENTRIES = 500;
const MAX_URL_LENGTH = 2_048;
const ORDER_CAPABILITY = 'dev.ucp.shopping.order';

const AgentProfileSchema = z.looseObject({
  ucp: z.looseObject({
    capabilities: z.record(z.string(), z.array(z.looseObject({
      config: z.looseObject({ webhook_url: z.string().optional() }).optional(),
    }))).optional(),
  }),
});

/**
 * Addresses that are not routable on the public internet: loopback, private,
 * link-local, carrier-grade NAT, documentation, multicast and reserved
 * ranges. IPv4-mapped IPv6 addresses are matched against the IPv4 ranges;
 * NAT64 and 6to4 addresses embed IPv4 addresses and are refused as a whole.
 */
const NON_PUBLIC_ADDRESSES = createNonPublicAddressList();

function createNonPublicAddressList(): BlockList {
  const list = new BlockList();
  const ipv4: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  const ipv6: Array<[string, number]> = [
    ['::', 96],
    ['64:ff9b::', 96],
    ['100::', 64],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
  ];

  for (const [network, prefix] of ipv4) {
    list.addSubnet(network, prefix, 'ipv4');
  }

  for (const [network, prefix] of ipv6) {
    list.addSubnet(network, prefix, 'ipv6');
  }

  return list;
}

/**
 * Delivers order events to the webhook URL a platform declares in its
 * profile (order capability `config.webhook_url`), following Standard
 * Webhooks headers and the UCP REST signing binding.
 */
export class ReactionaryUCPWebhooks {
  /** Insertion ordered, so the first entry is the least recently used. */
  private readonly profileCache = new Map<string, { webhookUrl?: string; expiresAt: number }>();
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  private warnedUnsigned = false;

  public constructor(
    private readonly options: ReactionaryUCPWebhookOptions,
    /** The business profile URL, sent as the deliveries' UCP-Agent. */
    private readonly businessProfileUrl: string,
  ) {
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.fetchImpl = options.fetch ?? ((url, init) => this.fetchPublic(url, init));
  }

  /** The order webhook URL declared in a platform's profile, if any. */
  public async resolveOrderWebhookUrl(agentProfileUrl: string): Promise<string | undefined> {
    const cached = this.profileCache.get(agentProfileUrl);
    if (cached && cached.expiresAt > Date.now()) {
      this.profileCache.delete(agentProfileUrl);
      this.profileCache.set(agentProfileUrl, cached);

      return cached.webhookUrl;
    }

    const webhookUrl = await this.isAllowedUrl(agentProfileUrl)
      ? await this.fetchOrderWebhookUrl(agentProfileUrl)
      : undefined;
    this.cacheProfile(agentProfileUrl, webhookUrl);

    return webhookUrl;
  }

  /**
   * Sends an order event without waiting for it. Failed attempts are retried
   * as the same event: same Webhook-Id, Webhook-Timestamp and body.
   */
  public deliver(webhookUrl: string, order: object): void {
    void this.deliverIfAllowed(webhookUrl, order);
  }

  private async deliverIfAllowed(webhookUrl: string, order: object): Promise<void> {
    if (!await this.isAllowedUrl(webhookUrl)) {
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

    await this.attempt(webhookUrl, headers, body, 0);
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
      await response.body?.cancel();

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

      if (!response.ok) {
        await response.body?.cancel();
        return undefined;
      }

      const profile = AgentProfileSchema.safeParse(JSON.parse(await this.readLimitedText(response)));
      const capabilities = profile.success ? profile.data.ucp.capabilities?.[ORDER_CAPABILITY] ?? [] : [];
      const webhookUrl = capabilities.find((capability) => capability.config?.webhook_url)?.config?.webhook_url;

      return webhookUrl && await this.isAllowedUrl(webhookUrl) ? webhookUrl : undefined;
    } catch {
      return undefined;
    }
  }

  private cacheProfile(agentProfileUrl: string, webhookUrl: string | undefined): void {
    this.profileCache.delete(agentProfileUrl);
    this.profileCache.set(agentProfileUrl, { webhookUrl, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });

    const maxEntries = this.options.profileCacheMaxEntries ?? DEFAULT_PROFILE_CACHE_MAX_ENTRIES;
    for (const key of this.profileCache.keys()) {
      if (this.profileCache.size <= maxEntries) {
        break;
      }

      this.profileCache.delete(key);
    }
  }

  /**
   * Whether an agent profile or webhook URL may be fetched or delivered to.
   * Both come from the platform, so by default only https URLs naming public
   * hosts pass. Override to change the policy.
   */
  protected async isAllowedUrl(value: string): Promise<boolean> {
    if (value.length > MAX_URL_LENGTH) {
      return false;
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      return false;
    }

    const schemeAllowed = url.protocol === 'https:' || (url.protocol === 'http:' && Boolean(this.options.allowInsecureUrls));

    if (!schemeAllowed || url.username || url.password) {
      return false;
    }

    if (!this.options.allowPrivateNetworks && !this.isPublicHost(url.hostname)) {
      return false;
    }

    try {
      return await this.options.validateUrl?.(url) ?? true;
    } catch {
      return false;
    }
  }

  /**
   * Refuses localhost and IP literals in non-public ranges. Other host names
   * are checked against the addresses they resolve to when connecting.
   */
  protected isPublicHost(hostname: string): boolean {
    const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

    if (host === 'localhost' || host.endsWith('.localhost')) {
      return false;
    }

    return isIP(host) === 0 || this.isPublicAddress(host);
  }

  protected isPublicAddress(address: string): boolean {
    const family = isIP(address);

    return family !== 0 && !NON_PUBLIC_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6');
  }

  /** Resolves a host name to all of its addresses. */
  protected resolveHost(hostname: string): Promise<LookupAddress[]> {
    return new Promise((resolve, reject) => {
      lookup(hostname, { all: true }, (error, addresses) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(addresses);
      });
    });
  }

  /**
   * Validates the addresses at the moment of connecting, so a host name that
   * resolves differently between a check and the connection (DNS rebinding)
   * cannot reach a non-public address.
   */
  private readonly lookupPublic: LookupFunction = (hostname, options, callback) => {
    this.resolveHost(hostname).then(
      (addresses) => {
        const [first] = addresses;

        if (!first || (!this.options.allowPrivateNetworks && !addresses.every(({ address }) => this.isPublicAddress(address)))) {
          callback(new Error(`${hostname} does not resolve to a public address`), '', 0);
          return;
        }

        if (options.all) {
          callback(null, addresses);
          return;
        }

        callback(null, first.address, first.family);
      },
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), '', 0),
    );
  };

  /** Never follows redirects, and buffers at most `maxResponseBytes` of the response. */
  private fetchPublic(url: string, init: RequestInit): Promise<Response> {
    const maxBytes = this.options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    const send = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const request = send(
        url,
        {
          method: init.method,
          headers: Object.fromEntries(new Headers(init.headers).entries()),
          lookup: this.lookupPublic,
          // A fresh agent: the global agents may route through an environment
          // proxy, which would resolve the host and bypass the lookup check.
          agent: false,
          signal: init.signal ?? undefined,
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          let received = 0;

          incoming.on('data', (chunk: Buffer) => {
            received += chunk.length;

            if (received > maxBytes) {
              incoming.destroy(new Error(`The response exceeds ${maxBytes} bytes`));
              return;
            }

            chunks.push(chunk);
          });
          incoming.on('error', reject);
          incoming.on('end', () => {
            const status = incoming.statusCode ?? 502;
            const body = status === 204 || status === 304 || chunks.length === 0 ? null : Buffer.concat(chunks);

            resolve(new Response(body, { status }));
          });
        },
      );

      request.on('error', reject);
      request.end(typeof init.body === 'string' ? init.body : undefined);
    });
  }

  private async readLimitedText(response: Response): Promise<string> {
    const maxBytes = this.options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    const reader = response.body?.getReader();

    if (!reader) {
      return '';
    }

    const decoder = new TextDecoder();
    let text = '';
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return text + decoder.decode();
      }

      received += value.byteLength;

      if (received > maxBytes) {
        await reader.cancel();
        throw new Error(`The response exceeds ${maxBytes} bytes`);
      }

      text += decoder.decode(value, { stream: true });
    }
  }
}
