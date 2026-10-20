import { SessionSchema, type Cache, type Session } from '@reactionary/core';
import { createHash, randomBytes } from 'node:crypto';
import * as z from 'zod';
import { jsonResponse, secureEquals } from './reactionary-ucp-http.js';
import {
  hashIdentityToken,
  ReactionaryUCPIdentityState,
  UCPAuthorizationCodeStateSchema,
  UCPAuthorizationRequestStateSchema,
  UCPConsentStateSchema,
  UCPTokenStateSchema,
  type UCPTokenState,
} from './reactionary-ucp-identity-state.js';

export interface ReactionaryUCPIdentityClient {
  clientId: string;
  redirectUris: string[];
  clientSecret?: string;
}

export interface ReactionaryUCPIdentityScope {
  scope: string;
  description?: string;
  gates?: Array<{
    method?: string;
    pathPattern: RegExp;
  }>;
}

export interface ReactionaryUCPIdentityConsentContext {
  clientId: string;
  customerId: string;
  scopes: string[];
  approveUrl: string;
  grant: string;
}

export interface ReactionaryUCPIdentityOptions {
  issuer: string;
  loginUrl: string;
  stateSecret: string;
  clients: ReactionaryUCPIdentityClient[];
  scopes?: ReactionaryUCPIdentityScope[];
  baseUrl?: string;
  internalApiKey?: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  renderConsentPage?: (context: ReactionaryUCPIdentityConsentContext) => string;
}

export interface UCPCompleteAuthorizationPayload {
  requestId: string;
  customerId: string;
  session: Session;
}

export interface UCPBearerResolution {
  tokenHash: string;
  expiresAt: number;
  scope: string;
  session: Session;
}

export const DEFAULT_UCP_IDENTITY_SCOPES: ReactionaryUCPIdentityScope[] = [
  {
    scope: 'dev.ucp.shopping.order:read',
    description: 'Read your orders',
    gates: [{ method: 'GET', pathPattern: /^\/orders\// }],
  },
];

const PENDING_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 60;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_STATE_SECRET_LENGTH = 32;

export class ReactionaryUCPIdentity {
  private readonly state: ReactionaryUCPIdentityState;
  private readonly scopes: ReactionaryUCPIdentityScope[];
  private readonly baseUrl: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  public constructor(
    private readonly options: ReactionaryUCPIdentityOptions,
    cache?: Cache,
  ) {
    if (options.stateSecret.length < MIN_STATE_SECRET_LENGTH) {
      throw new Error(`identity.stateSecret must be at least ${MIN_STATE_SECRET_LENGTH} characters long.`);
    }

    this.state = new ReactionaryUCPIdentityState(options.stateSecret, cache);
    this.scopes = options.scopes ?? DEFAULT_UCP_IDENTITY_SCOPES;
    this.baseUrl = (options.baseUrl ?? `${options.issuer}/ucp`).replace(/\/$/, '');
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
  }

  public getScopeNames(): string[] {
    return this.scopes.map((scope) => scope.scope);
  }

  public async handleHttp(request: Request, path: string): Promise<Response | undefined> {
    const rawPathname = new URL(request.url).pathname;

    if (rawPathname === '/.well-known/oauth-authorization-server' && request.method === 'GET') {
      return jsonResponse(this.getMetadata());
    }

    if (path === '/oauth/authorize' && request.method === 'GET') {
      return this.handleAuthorize(request);
    }

    if (path === '/oauth/complete' && request.method === 'POST') {
      return this.handleComplete(request);
    }

    if (path === '/oauth/consent' && request.method === 'GET') {
      return this.handleConsentPage(request);
    }

    if (path === '/oauth/consent' && request.method === 'POST') {
      return this.handleConsentDecision(request);
    }

    if (path === '/oauth/token' && request.method === 'POST') {
      return this.handleToken(request);
    }

    if (path === '/oauth/revoke' && request.method === 'POST') {
      return this.handleRevoke(request);
    }

    return undefined;
  }

  public async completeAuthorization(
    payload: UCPCompleteAuthorizationPayload,
  ): Promise<{ continueUrl: string }> {
    const opened = this.state.open(
      'authorization_request',
      payload.requestId,
      UCPAuthorizationRequestStateSchema,
    );

    if (!opened) {
      throw new Error('Unknown or expired authorization request.');
    }

    const grant = this.state.seal(
      'consent',
      {
        ...opened.state,
        customerId: payload.customerId,
        session: payload.session,
      },
      PENDING_TTL_SECONDS,
    );

    const continueUrl = new URL(`${this.baseUrl}/oauth/consent`);
    continueUrl.searchParams.set('grant', grant);

    return { continueUrl: continueUrl.toString() };
  }

  public async resolveBearer(request: Request): Promise<UCPBearerResolution | Response | undefined> {
    const authorization = request.headers.get('authorization');

    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      return undefined;
    }

    const token = authorization.slice('bearer '.length).trim();
    const opened = this.state.open('token', token, UCPTokenStateSchema);

    if (!opened || opened.state.kind !== 'access') {
      return bearerChallengeResponse(401, 'invalid_token', 'The access token is invalid or expired.');
    }

    const tokenHash = hashIdentityToken(token);
    const revokedHashes = [tokenHash];

    if (opened.state.refreshTokenHash) {
      revokedHashes.push(opened.state.refreshTokenHash);
    }

    if (await this.state.isTokenRevoked(revokedHashes)) {
      return bearerChallengeResponse(401, 'invalid_token', 'The access token has been revoked.');
    }

    const overlaySession = await this.state.getSessionOverlay(tokenHash);

    return {
      tokenHash,
      expiresAt: opened.expiresAt,
      scope: opened.state.scope,
      session: overlaySession ?? opened.state.session,
    };
  }

  public checkAccess(
    method: string,
    path: string,
    bearer: UCPBearerResolution | undefined,
  ): Response | undefined {
    const requiredScopes = this.scopes.filter((scope) =>
      scope.gates?.some(
        (gate) =>
          (!gate.method || gate.method === method) && gate.pathPattern.test(path),
      ),
    );

    if (requiredScopes.length === 0) {
      return undefined;
    }

    const scopeNames = requiredScopes.map((scope) => scope.scope);

    if (!bearer) {
      return bearerChallengeResponse(
        401,
        'identity_required',
        'This operation requires a linked user identity.',
        scopeNames,
      );
    }

    const grantedScopes = bearer.scope.split(' ');
    const missing = scopeNames.filter((scope) => !grantedScopes.includes(scope));

    if (missing.length > 0) {
      return bearerChallengeResponse(
        403,
        'insufficient_scope',
        'The access token does not grant the required scope.',
        missing,
      );
    }

    return undefined;
  }

  public async persistBearerSession(
    bearer: UCPBearerResolution,
    session: Session,
  ): Promise<void> {
    const remainingTtlSeconds = Math.max(1, Math.ceil((bearer.expiresAt - Date.now()) / 1000));
    await this.state.putSessionOverlay(bearer.tokenHash, session, remainingTtlSeconds);
  }

  private getMetadata(): Record<string, unknown> {
    return {
      issuer: this.options.issuer,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      revocation_endpoint: `${this.baseUrl}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: this.getScopeNames(),
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    };
  }

  private async handleAuthorize(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id') ?? '';
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const client = this.options.clients.find((candidate) => candidate.clientId === clientId);

    if (!client || !client.redirectUris.includes(redirectUri)) {
      return jsonResponse(
        { error: 'invalid_request', error_description: 'Unknown client_id or unregistered redirect_uri.' },
        { status: 400 },
      );
    }

    const state = url.searchParams.get('state') ?? undefined;
    const responseType = url.searchParams.get('response_type');
    const scope = url.searchParams.get('scope') ?? '';
    const codeChallenge = url.searchParams.get('code_challenge');
    const codeChallengeMethod = url.searchParams.get('code_challenge_method');

    if (responseType !== 'code') {
      return authorizeErrorRedirect(redirectUri, 'unsupported_response_type', state);
    }

    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      return authorizeErrorRedirect(redirectUri, 'invalid_request', state, 'PKCE with S256 is required.');
    }

    const knownScopes = this.getScopeNames();
    const requestedScopes = scope.split(' ').filter((entry) => entry.length > 0);

    if (requestedScopes.some((entry) => !knownScopes.includes(entry))) {
      return authorizeErrorRedirect(redirectUri, 'invalid_scope', state);
    }

    const requestId = this.state.seal(
      'authorization_request',
      {
        clientId,
        redirectUri,
        scope: requestedScopes.join(' '),
        ...(state !== undefined ? { state } : {}),
        codeChallenge,
      },
      PENDING_TTL_SECONDS,
    );

    const loginUrl = new URL(this.options.loginUrl);
    loginUrl.searchParams.set('ucp_request_id', requestId);

    return redirectResponse(loginUrl.toString());
  }

  private async handleComplete(request: Request): Promise<Response> {
    if (!this.options.internalApiKey) {
      return jsonResponse(
        { error: 'invalid_request', error_description: 'The completion endpoint is not enabled; configure internalApiKey.' },
        { status: 404 },
      );
    }

    const providedKey = request.headers.get('x-ucp-internal-key') ?? '';

    if (!secureEquals(providedKey, this.options.internalApiKey)) {
      return jsonResponse({ error: 'invalid_client' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const parsed = CompleteAuthorizationBodySchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: 'invalid_request', error_description: 'Body must contain request_id, customer_id and session.' },
        { status: 400 },
      );
    }

    try {
      const { continueUrl } = await this.completeAuthorization({
        requestId: parsed.data.request_id,
        customerId: parsed.data.customer_id,
        session: parsed.data.session,
      });

      return jsonResponse({ continue_url: continueUrl });
    } catch {
      return jsonResponse(
        { error: 'invalid_request', error_description: 'Unknown or expired authorization request.' },
        { status: 400 },
      );
    }
  }

  private async handleConsentPage(request: Request): Promise<Response> {
    const grant = new URL(request.url).searchParams.get('grant') ?? '';
    const opened = this.state.open('consent', grant, UCPConsentStateSchema);

    if (!opened) {
      return htmlResponse('<p>This authorization request is unknown or has expired.</p>', 400);
    }

    const context: ReactionaryUCPIdentityConsentContext = {
      clientId: opened.state.clientId,
      customerId: opened.state.customerId,
      scopes: opened.state.scope.split(' ').filter((entry) => entry.length > 0),
      approveUrl: `${this.baseUrl}/oauth/consent`,
      grant,
    };

    const render = this.options.renderConsentPage ?? renderDefaultConsentPage;
    return htmlResponse(render(context));
  }

  private async handleConsentDecision(request: Request): Promise<Response> {
    const form = await request.formData().catch(() => undefined);
    const grant = readFormValue(form, 'grant');
    const decision = readFormValue(form, 'decision');
    const opened = this.state.open('consent', grant, UCPConsentStateSchema);

    if (!opened || !(await this.state.markUsed(grant, PENDING_TTL_SECONDS))) {
      return htmlResponse('<p>This authorization request is unknown or has expired.</p>', 400);
    }

    if (decision !== 'approve') {
      return authorizeErrorRedirect(opened.state.redirectUri, 'access_denied', opened.state.state);
    }

    const code = this.state.seal('code', opened.state, CODE_TTL_SECONDS);
    const redirectUrl = new URL(opened.state.redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('iss', this.options.issuer);

    if (opened.state.state !== undefined) {
      redirectUrl.searchParams.set('state', opened.state.state);
    }

    return redirectResponse(redirectUrl.toString());
  }

  private async handleToken(request: Request): Promise<Response> {
    const form = await request.formData().catch(() => undefined);
    const client = this.authenticateClient(request, form);

    if (!client) {
      return jsonResponse({ error: 'invalid_client' }, {
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="ucp"' },
      });
    }

    const grantType = readFormValue(form, 'grant_type');

    if (grantType === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(client, form);
    }

    if (grantType === 'refresh_token') {
      return this.handleRefreshTokenGrant(client, form);
    }

    return jsonResponse({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  private async handleAuthorizationCodeGrant(
    client: ReactionaryUCPIdentityClient,
    form: FormData | undefined,
  ): Promise<Response> {
    const code = readFormValue(form, 'code');
    const codeVerifier = readFormValue(form, 'code_verifier');
    const redirectUri = readFormValue(form, 'redirect_uri');
    const opened = code ? this.state.open('code', code, UCPAuthorizationCodeStateSchema) : undefined;

    if (
      !opened ||
      !(await this.state.markUsed(code, CODE_TTL_SECONDS)) ||
      opened.state.clientId !== client.clientId ||
      opened.state.redirectUri !== redirectUri ||
      !verifyPkce(codeVerifier, opened.state.codeChallenge)
    ) {
      return jsonResponse({ error: 'invalid_grant' }, { status: 400 });
    }

    const refreshToken = this.state.seal(
      'token',
      {
        kind: 'refresh',
        clientId: opened.state.clientId,
        customerId: opened.state.customerId,
        scope: opened.state.scope,
        session: opened.state.session,
      },
      this.refreshTokenTtlSeconds,
    );
    const accessToken = this.mintAccessToken({
      kind: 'access',
      clientId: opened.state.clientId,
      customerId: opened.state.customerId,
      scope: opened.state.scope,
      session: opened.state.session,
      refreshTokenHash: hashIdentityToken(refreshToken),
    });

    return jsonResponse({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: opened.state.scope,
    });
  }

  private async handleRefreshTokenGrant(
    client: ReactionaryUCPIdentityClient,
    form: FormData | undefined,
  ): Promise<Response> {
    const refreshToken = readFormValue(form, 'refresh_token');
    const opened = refreshToken
      ? this.state.open('token', refreshToken, UCPTokenStateSchema)
      : undefined;
    const refreshTokenHash = hashIdentityToken(refreshToken);

    if (
      !opened ||
      opened.state.kind !== 'refresh' ||
      opened.state.clientId !== client.clientId ||
      (await this.state.isTokenRevoked([refreshTokenHash]))
    ) {
      return jsonResponse({ error: 'invalid_grant' }, { status: 400 });
    }

    const accessToken = this.mintAccessToken({
      kind: 'access',
      clientId: opened.state.clientId,
      customerId: opened.state.customerId,
      scope: opened.state.scope,
      session: opened.state.session,
      refreshTokenHash,
    });

    return jsonResponse({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlSeconds,
      scope: opened.state.scope,
    });
  }

  private mintAccessToken(state: UCPTokenState): string {
    return this.state.seal('token', state, this.accessTokenTtlSeconds);
  }

  private async handleRevoke(request: Request): Promise<Response> {
    const form = await request.formData().catch(() => undefined);
    const client = this.authenticateClient(request, form);

    if (!client) {
      return jsonResponse({ error: 'invalid_client' }, { status: 401 });
    }

    const token = readFormValue(form, 'token');
    const opened = token ? this.state.open('token', token, UCPTokenStateSchema) : undefined;

    if (opened && opened.state.clientId === client.clientId) {
      const remainingTtlSeconds = Math.max(1, Math.ceil((opened.expiresAt - Date.now()) / 1000));
      await this.state.revokeToken(token, remainingTtlSeconds);
    }

    return new Response(null, { status: 200 });
  }

  private authenticateClient(
    request: Request,
    form: FormData | undefined,
  ): ReactionaryUCPIdentityClient | undefined {
    const authorization = request.headers.get('authorization');
    let clientId = readFormValue(form, 'client_id');
    let clientSecret = readFormValue(form, 'client_secret');

    if (authorization?.toLowerCase().startsWith('basic ')) {
      const decoded = Buffer.from(authorization.slice('basic '.length), 'base64').toString('utf-8');
      const separatorIndex = decoded.indexOf(':');

      if (separatorIndex >= 0) {
        clientId = decodeURIComponent(decoded.slice(0, separatorIndex));
        clientSecret = decodeURIComponent(decoded.slice(separatorIndex + 1));
      }
    }

    const client = this.options.clients.find((candidate) => candidate.clientId === clientId);

    if (!client) {
      return undefined;
    }

    if (client.clientSecret) {
      return clientSecret && secureEquals(clientSecret, client.clientSecret) ? client : undefined;
    }

    return client;
  }
}

const CompleteAuthorizationBodySchema = z.object({
  request_id: z.string(),
  customer_id: z.string(),
  session: SessionSchema,
});

function readFormValue(form: FormData | undefined, key: string): string {
  const value = form?.get(key);
  return typeof value === 'string' ? value : '';
}

function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier) {
    return false;
  }

  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return secureEquals(computed, codeChallenge);
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}

function authorizeErrorRedirect(
  redirectUri: string,
  error: string,
  state: string | undefined,
  description?: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);

  if (description) {
    url.searchParams.set('error_description', description);
  }

  if (state !== undefined) {
    url.searchParams.set('state', state);
  }

  return redirectResponse(url.toString());
}

function bearerChallengeResponse(
  status: number,
  error: string,
  description: string,
  scopes?: string[],
): Response {
  const scopePart = scopes && scopes.length > 0 ? `, scope="${scopes.join(' ')}"` : '';

  return jsonResponse(
    { error, error_description: description },
    {
      status,
      headers: {
        'www-authenticate': `Bearer realm="ucp", error="${error}", error_description="${description}"${scopePart}`,
      },
    },
  );
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(`<!doctype html><html><body>${body}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function renderDefaultConsentPage(context: ReactionaryUCPIdentityConsentContext): string {
  const scopeList = context.scopes.length > 0
    ? `<ul>${context.scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join('')}</ul>`
    : '<p>No additional permissions requested.</p>';

  return [
    `<h1>Authorize ${escapeHtml(context.clientId)}</h1>`,
    `<p>The agent <strong>${escapeHtml(context.clientId)}</strong> wants to act on your behalf with these permissions:</p>`,
    scopeList,
    `<form method="post" action="${escapeHtml(context.approveUrl)}">`,
    `<input type="hidden" name="grant" value="${escapeHtml(context.grant)}">`,
    '<button name="decision" value="approve" type="submit">Approve</button>',
    '<button name="decision" value="deny" type="submit">Deny</button>',
    '</form>',
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
