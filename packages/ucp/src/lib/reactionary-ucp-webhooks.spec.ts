import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { toPublicSigningJwk, type UCPSigningKey } from './reactionary-ucp-signing.js';
import { ReactionaryUCPWebhooks } from './reactionary-ucp-webhooks.js';

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
