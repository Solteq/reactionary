import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import type { LookupAddress } from 'node:dns';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPublicSigningJwk, type UCPSigningKey } from './reactionary-ucp-signing.js';
import { ReactionaryUCPWebhooks, type ReactionaryUCPWebhookOptions } from './reactionary-ucp-webhooks.js';

const PROFILE_URL = 'https://shop.example.com/.well-known/ucp';
const AGENT_PROFILE_URL = 'https://agent.example.com/profile';
const WEBHOOK_URL = 'https://agent.example.com/webhooks/orders';

function createSigningKey(): UCPSigningKey {
  const privateKeyJwk = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' });
  return { kid: 'shop-2026', privateKeyJwk };
}

interface Delivery {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** A fetch that serves the agent profile and records webhook deliveries. */
function createAgent(statuses: number[] = []) {
  const deliveries: Delivery[] = [];
  const agentFetch: typeof fetch = async (input, init) => {
    const url = String(input);

    if (url === AGENT_PROFILE_URL) {
      return Response.json({
        ucp: { capabilities: { 'dev.ucp.shopping.order': [{ version: '2026-08-25', config: { webhook_url: WEBHOOK_URL } }] } },
      });
    }

    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    deliveries.push({ url, headers, body: String(init?.body) });
    return new Response(null, { status: statuses[deliveries.length - 1] ?? 200 });
  };

  return { deliveries, fetch: agentFetch };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('UCP order webhooks', () => {
  it('resolves the webhook URL from the platform profile, only over https unless allowed', async () => {
    const agent = createAgent();
    const webhooks = new ReactionaryUCPWebhooks({ fetch: agent.fetch }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBe(WEBHOOK_URL);
    expect(await webhooks.resolveOrderWebhookUrl('http://agent.example.com/profile')).toBeUndefined();
  });

  it('delivers a signed full entity with Standard Webhooks headers', async () => {
    const agent = createAgent();
    const signingKey = createSigningKey();
    const webhooks = new ReactionaryUCPWebhooks({ fetch: agent.fetch, signingKey }, PROFILE_URL);
    const order = { id: 'order-1', checkout_id: 'checkout_1' };

    webhooks.deliver(WEBHOOK_URL, order);
    await waitFor(() => agent.deliveries.length === 1);

    const [delivery] = agent.deliveries;
    expect(JSON.parse(delivery.body)).toEqual(order);
    expect(delivery.headers['webhook-id']).toMatch(/^evt_/);
    expect(delivery.headers['webhook-timestamp']).toMatch(/^\d{10}$/);
    expect(delivery.headers['ucp-agent']).toBe(`profile="${PROFILE_URL}"`);
    expect(delivery.headers['content-digest']).toBe(
      `sha-256=:${createHash('sha256').update(delivery.body).digest('base64')}:`,
    );

    // Rebuild the RFC 9421 signature base and verify it with the published key.
    const signatureInput = delivery.headers['signature-input'];
    const params = signatureInput.replace(/^sig1=/, '');
    const components = [...params.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((name) => name !== signingKey.kid);
    expect(components).toEqual(['@method', '@authority', '@path', 'ucp-agent', 'idempotency-key', 'content-digest', 'content-type']);
    const values: Record<string, string> = {
      '@method': 'POST',
      '@authority': 'agent.example.com',
      '@path': '/webhooks/orders',
    };
    const signatureBase = [
      ...components.map((name) => `"${name}": ${values[name] ?? delivery.headers[name]}`),
      `"@signature-params": ${params}`,
    ].join('\n');
    const signature = Buffer.from(delivery.headers['signature'].replace(/^sig1=:|:$/g, ''), 'base64');
    const publicKey = createPublicKey({ key: toPublicSigningJwk(signingKey), format: 'jwk' });

    expect(signature).toHaveLength(64);
    expect(verify('sha256', Buffer.from(signatureBase), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)).toBe(true);
  });

  it('retries a failed delivery as the same event', async () => {
    const agent = createAgent([500, 503]);
    const webhooks = new ReactionaryUCPWebhooks({ fetch: agent.fetch, retryDelaysMs: [5, 5] }, PROFILE_URL);

    webhooks.deliver(WEBHOOK_URL, { id: 'order-1' });
    await waitFor(() => agent.deliveries.length === 3);

    expect(agent.deliveries).toHaveLength(3);
    expect(new Set(agent.deliveries.map((delivery) => delivery.headers['webhook-id'])).size).toBe(1);
    expect(new Set(agent.deliveries.map((delivery) => delivery.headers['webhook-timestamp'])).size).toBe(1);
    expect(new Set(agent.deliveries.map((delivery) => delivery.body)).size).toBe(1);
  });
});

function createProfile(webhookUrl: string): Response {
  return Response.json({
    ucp: { capabilities: { 'dev.ucp.shopping.order': [{ version: '2026-08-25', config: { webhook_url: webhookUrl } }] } },
  });
}

describe('UCP webhook SSRF protection', () => {
  const NON_PUBLIC_URLS = [
    'https://127.0.0.1/profile',
    'https://127.1/profile',
    'https://2130706433/profile',
    'https://0x7f.0.0.1/profile',
    'https://localhost/profile',
    'https://localhost./profile',
    'https://metadata.localhost/profile',
    'https://[::1]/profile',
    'https://[::]/profile',
    'https://[::ffff:127.0.0.1]/profile',
    'https://[::ffff:a00:1]/profile',
    'https://[64:ff9b::7f00:1]/profile',
    'https://[2002:7f00:1::]/profile',
    'https://[fe80::1]/profile',
    'https://[fd00::1]/profile',
    'https://[fc00::1]/profile',
    'https://0.0.0.0/profile',
    'https://10.0.0.5/profile',
    'https://100.64.0.1/profile',
    'https://169.254.169.254/latest/meta-data',
    'https://172.16.0.1/profile',
    'https://172.31.255.255/profile',
    'https://192.168.1.1/profile',
    'https://198.18.0.1/profile',
    'https://224.0.0.1/profile',
    'https://255.255.255.255/profile',
    'https://user:secret@agent.example.com/profile',
    `https://agent.example.com/${'a'.repeat(3000)}`,
  ];

  function createRecordingFetch(respond: (url: string) => Response = () => new Response(null, { status: 200 })) {
    const urls: string[] = [];
    const recordingFetch: typeof fetch = async (input) => {
      urls.push(String(input));
      return respond(String(input));
    };

    return { urls, fetch: recordingFetch };
  }

  it.each(NON_PUBLIC_URLS)('refuses to fetch the agent profile %#', async (url) => {
    const recording = createRecordingFetch(() => createProfile(WEBHOOK_URL));
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl(url)).toBeUndefined();
    expect(recording.urls).toEqual([]);
  });

  it.each(NON_PUBLIC_URLS)('refuses to deliver to the webhook URL %#', async (url) => {
    const recording = createRecordingFetch();
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch }, PROFILE_URL);

    webhooks.deliver(url, { id: 'order-1' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(recording.urls).toEqual([]);
  });

  it.each(NON_PUBLIC_URLS.slice(0, -2))('drops a profile that declares the webhook URL %#', async (url) => {
    const recording = createRecordingFetch(() => createProfile(url));
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBeUndefined();
    expect(recording.urls).toEqual([AGENT_PROFILE_URL]);
  });

  it.each([
    'https://agent.example.com/profile',
    'https://93.184.216.34/profile',
    'https://[2606:4700:4700::1111]/profile',
    'https://172.32.0.1/profile',
    'https://[2001:4860:4860::8888]/profile',
  ])('accepts the public URL %s', async (url) => {
    const recording = createRecordingFetch(() => createProfile(url));
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl(url)).toBe(url);
  });

  it('accepts non-public URLs only with allowPrivateNetworks', async () => {
    const recording = createRecordingFetch(() => createProfile('https://127.0.0.1:9000/hooks'));
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch, allowPrivateNetworks: true }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl('https://localhost/profile')).toBe('https://127.0.0.1:9000/hooks');
  });

  it('lets validateUrl restrict URLs further, but not admit refused ones', async () => {
    const recording = createRecordingFetch(() => createProfile(WEBHOOK_URL));
    const webhooks = new ReactionaryUCPWebhooks({
      fetch: recording.fetch,
      validateUrl: (url) => url.hostname === 'agent.example.com',
    }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl('https://other.example.com/profile')).toBeUndefined();
    expect(await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBe(WEBHOOK_URL);

    const admitAll = new ReactionaryUCPWebhooks({ fetch: recording.fetch, validateUrl: () => true }, PROFILE_URL);

    expect(await admitAll.resolveOrderWebhookUrl('https://127.0.0.1/profile')).toBeUndefined();
  });

  it('refuses URLs when validateUrl throws', async () => {
    const recording = createRecordingFetch(() => createProfile(WEBHOOK_URL));
    const webhooks = new ReactionaryUCPWebhooks({
      fetch: recording.fetch,
      validateUrl: () => {
        throw new Error('boom');
      },
    }, PROFILE_URL);

    expect(await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBeUndefined();
  });

  it('drops profiles larger than maxResponseBytes', async () => {
    const padding = 'x'.repeat(2_000);
    const recording = createRecordingFetch(() => Response.json({
      padding,
      ucp: { capabilities: { 'dev.ucp.shopping.order': [{ config: { webhook_url: WEBHOOK_URL } }] } },
    }));

    const limited = new ReactionaryUCPWebhooks({ fetch: recording.fetch, maxResponseBytes: 1_000 }, PROFILE_URL);
    const roomy = new ReactionaryUCPWebhooks({ fetch: recording.fetch, maxResponseBytes: 10_000 }, PROFILE_URL);

    expect(await limited.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBeUndefined();
    expect(await roomy.resolveOrderWebhookUrl(AGENT_PROFILE_URL)).toBe(WEBHOOK_URL);
  });

  it('bounds the profile cache and evicts the least recently used profile', async () => {
    const recording = createRecordingFetch(() => createProfile(WEBHOOK_URL));
    const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch, profileCacheMaxEntries: 2 }, PROFILE_URL);
    const profile = (name: string) => `https://${name}.example.com/profile`;

    await webhooks.resolveOrderWebhookUrl(profile('a'));
    await webhooks.resolveOrderWebhookUrl(profile('b'));
    await webhooks.resolveOrderWebhookUrl(profile('a'));
    await webhooks.resolveOrderWebhookUrl(profile('c'));
    expect(recording.urls).toEqual([profile('a'), profile('b'), profile('c')]);

    await webhooks.resolveOrderWebhookUrl(profile('a'));
    await webhooks.resolveOrderWebhookUrl(profile('c'));
    expect(recording.urls).toEqual([profile('a'), profile('b'), profile('c')]);

    await webhooks.resolveOrderWebhookUrl(profile('b'));
    expect(recording.urls).toEqual([profile('a'), profile('b'), profile('c'), profile('b')]);
  });

  it('expires cached profiles', async () => {
    vi.useFakeTimers();

    try {
      const recording = createRecordingFetch(() => createProfile(WEBHOOK_URL));
      const webhooks = new ReactionaryUCPWebhooks({ fetch: recording.fetch }, PROFILE_URL);

      await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL);
      await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL);
      expect(recording.urls).toHaveLength(1);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await webhooks.resolveOrderWebhookUrl(AGENT_PROFILE_URL);
      expect(recording.urls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('UCP webhook built-in transport', () => {
  let receiver: Server | undefined;

  afterEach(async () => {
    const server = receiver;
    receiver = undefined;

    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });

  /** A loopback server standing in for an internal service. */
  async function listen(respond: (url: string, body: string) => { status?: number; body?: string }) {
    const received: Array<{ url: string; body: string }> = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({ url: request.url ?? '', body });
        const result = respond(request.url ?? '', body);
        response.writeHead(result.status ?? 200, { 'content-type': 'application/json' });
        response.end(result.body ?? '');
      });
    });
    receiver = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The test server is not listening on a TCP port.');
    }

    return { port: address.port, received };
  }

  class RebindingWebhooks extends ReactionaryUCPWebhooks {
    public constructor(options: ReactionaryUCPWebhookOptions, private readonly address: string) {
      super(options, PROFILE_URL);
    }

    protected override resolveHost(): Promise<LookupAddress[]> {
      return Promise.resolve([{ address: this.address, family: this.address.includes(':') ? 6 : 4 }]);
    }
  }

  it('fetches a profile and delivers over a real connection when private networks are allowed', async () => {
    let port = 0;
    const service = await listen(() => ({
      body: JSON.stringify({
        ucp: { capabilities: { 'dev.ucp.shopping.order': [{ config: { webhook_url: `http://127.0.0.1:${port}/hooks` } }] } },
      }),
    }));
    port = service.port;
    const webhooks = new ReactionaryUCPWebhooks({ allowInsecureUrls: true, allowPrivateNetworks: true, retryDelaysMs: [] }, PROFILE_URL);

    const webhookUrl = await webhooks.resolveOrderWebhookUrl(`http://127.0.0.1:${service.port}/profile`);
    expect(webhookUrl).toBe(`http://127.0.0.1:${service.port}/hooks`);

    webhooks.deliver(webhookUrl ?? '', { id: 'order-1' });
    await waitFor(() => service.received.length === 2);

    expect(service.received.map((entry) => entry.url)).toEqual(['/profile', '/hooks']);
    expect(JSON.parse(service.received[1].body)).toEqual({ id: 'order-1' });
  });

  it('does not connect to a host name that resolves to a loopback address (DNS rebinding)', async () => {
    const service = await listen(() => ({ body: '{}' }));
    const webhooks = new RebindingWebhooks({ allowInsecureUrls: true, retryDelaysMs: [] }, '127.0.0.1');

    expect(await webhooks.resolveOrderWebhookUrl(`http://rebind.example.com:${service.port}/profile`)).toBeUndefined();

    webhooks.deliver(`http://rebind.example.com:${service.port}/hooks`, { id: 'order-1' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(service.received).toEqual([]);
  });

  it.each(['10.0.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1'])(
    'does not connect to a host name that resolves to %s',
    async (address) => {
      const service = await listen(() => ({ body: '{}' }));
      const webhooks = new RebindingWebhooks({ allowInsecureUrls: true, retryDelaysMs: [] }, address);

      expect(await webhooks.resolveOrderWebhookUrl(`http://rebind.example.com:${service.port}/profile`)).toBeUndefined();
      expect(service.received).toEqual([]);
    },
  );

  it('does not read more than maxResponseBytes from a profile response', async () => {
    const service = await listen(() => ({ body: JSON.stringify({ padding: 'x'.repeat(5_000), ucp: {} }) }));
    const webhooks = new ReactionaryUCPWebhooks(
      { allowInsecureUrls: true, allowPrivateNetworks: true, maxResponseBytes: 1_000 },
      PROFILE_URL,
    );

    expect(await webhooks.resolveOrderWebhookUrl(`http://127.0.0.1:${service.port}/profile`)).toBeUndefined();
  });
});
