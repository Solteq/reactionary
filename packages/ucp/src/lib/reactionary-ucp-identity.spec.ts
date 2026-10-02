import { createInitialRequestContext } from '@reactionary/core';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';
import { ReactionaryUCPIdentity } from './reactionary-ucp-identity.js';

interface TokenResponseBody {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const CODE_VERIFIER = 'test-code-verifier-with-sufficient-entropy-0123456789';
const CODE_CHALLENGE = createHash('sha256').update(CODE_VERIFIER).digest('base64url');

function createIdentityServer() {
  return new ReactionaryUCPServer(() => ({}), {
    profile: {
      endpoint: 'https://shop.example.com/ucp',
      merchant: {
        name: 'Example shop',
        url: 'https://shop.example.com',
        contact: { email: 'support@example.com' },
      },
      keys: [],
    },
    identity: {
      issuer: 'https://shop.example.com',
      loginUrl: 'https://shop.example.com/account/login',
      stateSecret: 'test-state-secret-test-state-secret-123',
      internalApiKey: 'internal-test-key',
      clients: [
        {
          clientId: 'agent-client',
          clientSecret: 'agent-secret',
          redirectUris: ['https://agent.example.com/callback'],
        },
      ],
    },
  });
}

function getIdentity(server: ReactionaryUCPServer): ReactionaryUCPIdentity {
  if (!server.identity) {
    throw new Error('identity is not configured');
  }

  return server.identity;
}

async function authorizeToCode(server: ReactionaryUCPServer): Promise<string> {
  const authorizeUrl = new URL('https://shop.example.com/ucp/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', 'agent-client');
  authorizeUrl.searchParams.set('redirect_uri', 'https://agent.example.com/callback');
  authorizeUrl.searchParams.set('scope', 'dev.ucp.shopping.order:read');
  authorizeUrl.searchParams.set('state', 'agent-state');
  authorizeUrl.searchParams.set('code_challenge', CODE_CHALLENGE);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const authorizeResponse = await server.fetch(new Request(authorizeUrl));
  expect(authorizeResponse.status).toBe(302);

  const loginLocation = new URL(authorizeResponse.headers.get('location') ?? '');
  expect(loginLocation.pathname).toBe('/account/login');
  const requestId = loginLocation.searchParams.get('ucp_request_id') ?? '';
  expect(requestId).not.toBe('');

  const { continueUrl } = await getIdentity(server).completeAuthorization({
    requestId,
    customerId: 'customer-1',
    session: createInitialRequestContext().session,
  });

  const consentPage = await server.fetch(new Request(continueUrl));
  expect(consentPage.status).toBe(200);
  expect(await consentPage.text()).toContain('agent-client');

  const consentParams = new URL(continueUrl).searchParams;
  const consentResponse = await server.fetch(
    new Request('https://shop.example.com/ucp/oauth/consent', {
      method: 'POST',
      body: new URLSearchParams({
        grant: consentParams.get('grant') ?? '',
        decision: 'approve',
      }),
    }),
  );
  expect(consentResponse.status).toBe(302);

  const callbackLocation = new URL(consentResponse.headers.get('location') ?? '');
  expect(callbackLocation.origin + callbackLocation.pathname).toBe('https://agent.example.com/callback');
  expect(callbackLocation.searchParams.get('state')).toBe('agent-state');
  expect(callbackLocation.searchParams.get('iss')).toBe('https://shop.example.com');

  return callbackLocation.searchParams.get('code') ?? '';
}

async function exchangeCode(
  server: ReactionaryUCPServer,
  code: string,
  codeVerifier = CODE_VERIFIER,
): Promise<Response> {
  return server.fetch(
    new Request('https://shop.example.com/ucp/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'agent-client',
        client_secret: 'agent-secret',
        redirect_uri: 'https://agent.example.com/callback',
        code,
        code_verifier: codeVerifier,
      }),
    }),
  );
}

describe('ReactionaryUCPIdentity', () => {
  it('serves RFC 8414 metadata', async () => {
    const server = createIdentityServer();
    const response = await server.fetch(
      new Request('https://shop.example.com/.well-known/oauth-authorization-server'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      issuer: 'https://shop.example.com',
      authorization_endpoint: 'https://shop.example.com/ucp/oauth/authorize',
      token_endpoint: 'https://shop.example.com/ucp/oauth/token',
      revocation_endpoint: 'https://shop.example.com/ucp/oauth/revoke',
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['dev.ucp.shopping.order:read'],
    });
  });

  it('advertises identity linking in the UCP profile', async () => {
    const server = createIdentityServer();
    const response = await server.fetch(new Request('https://shop.example.com/.well-known/ucp'));

    expect(await response.json()).toMatchObject({
      ucp: {
        capabilities: {
          'dev.ucp.common.identity_linking': [
            {
              version: '2026-08-25',
              config: { scopes: ['dev.ucp.shopping.order:read'] },
            },
          ],
        },
      },
    });
  });

  it('completes the full authorization code flow with PKCE', async () => {
    const server = createIdentityServer();
    const code = await authorizeToCode(server);
    const tokenResponse = await exchangeCode(server, code);

    expect(tokenResponse.status).toBe(200);
    const tokens = await json<TokenResponseBody>(tokenResponse);
    expect(tokens).toMatchObject({
      token_type: 'Bearer',
      scope: 'dev.ucp.shopping.order:read',
    });
    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');

    const orderResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/orders/order-1', {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      }),
    );
    expect(orderResponse.status).not.toBe(401);
    expect(orderResponse.status).not.toBe(403);
  });

  it('gates order routes behind identity linking', async () => {
    const server = createIdentityServer();
    const response = await server.fetch(
      new Request('https://shop.example.com/ucp/orders/order-1'),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('identity_required');
    expect(response.headers.get('www-authenticate')).toContain('dev.ucp.shopping.order:read');
  });

  it('rejects a wrong PKCE verifier and single-use code replay', async () => {
    const server = createIdentityServer();
    const code = await authorizeToCode(server);

    const wrongVerifier = await exchangeCode(server, code, 'wrong-verifier-wrong-verifier-wrong');
    expect(wrongVerifier.status).toBe(400);
    expect(await json<Record<string, unknown>>(wrongVerifier)).toMatchObject({ error: 'invalid_grant' });

    const replay = await exchangeCode(server, code);
    expect(replay.status).toBe(400);
    expect(await json<Record<string, unknown>>(replay)).toMatchObject({ error: 'invalid_grant' });
  });

  it('rejects bad client credentials at the token endpoint', async () => {
    const server = createIdentityServer();
    const response = await server.fetch(
      new Request('https://shop.example.com/ucp/oauth/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'agent-client',
          client_secret: 'wrong-secret',
          code: 'irrelevant',
          code_verifier: CODE_VERIFIER,
          redirect_uri: 'https://agent.example.com/callback',
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await json<Record<string, unknown>>(response)).toMatchObject({ error: 'invalid_client' });
  });

  it('rejects an unregistered redirect_uri at the authorize endpoint', async () => {
    const server = createIdentityServer();
    const authorizeUrl = new URL('https://shop.example.com/ucp/oauth/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', 'agent-client');
    authorizeUrl.searchParams.set('redirect_uri', 'https://evil.example.com/callback');
    authorizeUrl.searchParams.set('code_challenge', CODE_CHALLENGE);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    const response = await server.fetch(new Request(authorizeUrl));
    expect(response.status).toBe(400);
  });

  it('refreshes and revokes tokens', async () => {
    const server = createIdentityServer();
    const code = await authorizeToCode(server);
    const tokens = await json<TokenResponseBody>(await exchangeCode(server, code));

    const refreshResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/oauth/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'agent-client',
          client_secret: 'agent-secret',
          refresh_token: tokens.refresh_token ?? '',
        }),
      }),
    );
    expect(refreshResponse.status).toBe(200);
    const refreshed = await json<TokenResponseBody>(refreshResponse);
    expect(typeof refreshed.access_token).toBe('string');

    const revokeResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/oauth/revoke', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: 'agent-client',
          client_secret: 'agent-secret',
          token: tokens.refresh_token ?? '',
        }),
      }),
    );
    expect(revokeResponse.status).toBe(200);

    const afterRevoke = await server.fetch(
      new Request('https://shop.example.com/ucp/orders/order-1', {
        headers: { authorization: `Bearer ${refreshed.access_token}` },
      }),
    );
    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.headers.get('www-authenticate')).toContain('invalid_token');
  });

  it('completes authorization over the internal HTTP endpoint for split deployments', async () => {
    const server = createIdentityServer();
    const authorizeUrl = new URL('https://shop.example.com/ucp/oauth/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', 'agent-client');
    authorizeUrl.searchParams.set('redirect_uri', 'https://agent.example.com/callback');
    authorizeUrl.searchParams.set('scope', '');
    authorizeUrl.searchParams.set('code_challenge', CODE_CHALLENGE);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    const authorizeResponse = await server.fetch(new Request(authorizeUrl));
    const loginLocation = new URL(authorizeResponse.headers.get('location') ?? '');
    const requestId = loginLocation.searchParams.get('ucp_request_id') ?? '';

    const unauthorized = await server.fetch(
      new Request('https://shop.example.com/ucp/oauth/complete', {
        method: 'POST',
        headers: { 'x-ucp-internal-key': 'wrong-key', 'content-type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          customer_id: 'customer-1',
          session: createInitialRequestContext().session,
        }),
      }),
    );
    expect(unauthorized.status).toBe(401);

    const completed = await server.fetch(
      new Request('https://shop.example.com/ucp/oauth/complete', {
        method: 'POST',
        headers: { 'x-ucp-internal-key': 'internal-test-key', 'content-type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          customer_id: 'customer-1',
          session: createInitialRequestContext().session,
        }),
      }),
    );
    expect(completed.status).toBe(200);
    const { continue_url: continueUrl } = await json<{ continue_url: string }>(completed);
    expect(continueUrl).toContain('/ucp/oauth/consent?');
  });

  it('works without any cache: sealed state is self-contained', async () => {
    const identity = new ReactionaryUCPIdentity({
      issuer: 'https://shop.example.com',
      loginUrl: 'https://shop.example.com/account/login',
      stateSecret: 'test-state-secret-test-state-secret-123',
      clients: [
        {
          clientId: 'agent-client',
          clientSecret: 'agent-secret',
          redirectUris: ['https://agent.example.com/callback'],
        },
      ],
    });

    const authorizeUrl = new URL('https://shop.example.com/ucp/oauth/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', 'agent-client');
    authorizeUrl.searchParams.set('redirect_uri', 'https://agent.example.com/callback');
    authorizeUrl.searchParams.set('scope', 'dev.ucp.shopping.order:read');
    authorizeUrl.searchParams.set('code_challenge', CODE_CHALLENGE);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    const authorizeResponse = await identity.handleHttp(new Request(authorizeUrl), '/oauth/authorize');
    const requestId = new URL(authorizeResponse?.headers.get('location') ?? '').searchParams.get('ucp_request_id') ?? '';

    const { continueUrl } = await identity.completeAuthorization({
      requestId,
      customerId: 'customer-1',
      session: createInitialRequestContext().session,
    });

    const grant = new URL(continueUrl).searchParams.get('grant') ?? '';
    const consentResponse = await identity.handleHttp(
      new Request('https://shop.example.com/ucp/oauth/consent', {
        method: 'POST',
        body: new URLSearchParams({ grant, decision: 'approve' }),
      }),
      '/oauth/consent',
    );
    const code = new URL(consentResponse?.headers.get('location') ?? '').searchParams.get('code') ?? '';

    const tokenResponse = await identity.handleHttp(
      new Request('https://shop.example.com/ucp/oauth/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'agent-client',
          client_secret: 'agent-secret',
          redirect_uri: 'https://agent.example.com/callback',
          code,
          code_verifier: CODE_VERIFIER,
        }),
      }),
      '/oauth/token',
    );
    expect(tokenResponse?.status).toBe(200);
    const tokens = await json<TokenResponseBody>(tokenResponse as Response);

    const bearer = await identity.resolveBearer(
      new Request('https://shop.example.com/ucp/orders/order-1', {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      }),
    );
    expect(bearer).not.toBeInstanceOf(Response);
    expect(bearer && 'scope' in bearer ? bearer.scope : '').toBe('dev.ucp.shopping.order:read');
  });
});
