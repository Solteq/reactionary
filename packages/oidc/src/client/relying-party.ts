import * as z from 'zod';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { DEFAULT_SCOPES, type ExternalIdentityProvider } from '../schema/external-identity-provider.schema.js';
import type { OidcMetadata } from './discovery.js';

const ALLOWED_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384'];
const CLOCK_TOLERANCE_SECONDS = 30;

export type OidcTokens = {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type OidcRefreshedTokens = {
  accessToken: string;
  /** The identity provider rotates refresh tokens only sometimes; when it does not, the old one stays valid. */
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
};

const RefreshResponseSchema = z.looseObject({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  expires_in: z.number().optional(),
});

const TokenResponseSchema = z.looseObject({
  id_token: z.string(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
});

export function buildAuthorizationUrl(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  request: { callbackUrl: string; state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL(metadata.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', request.callbackUrl);
  url.searchParams.set('scope', (provider.scopes ?? DEFAULT_SCOPES).join(' '));
  url.searchParams.set('state', request.state);
  url.searchParams.set('nonce', request.nonce);
  url.searchParams.set('code_challenge', request.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Userinfo is best effort and sits in the login path, so a slow endpoint must not hold the login up. */
const USERINFO_TIMEOUT_MS = 5000;

export type TokenEndpointAuthMethod = NonNullable<ExternalIdentityProvider['tokenEndpointAuthMethod']>;

/**
 * How the client authenticates at the token endpoint: the configured method; none without a secret; otherwise
 * client_secret_post unless the provider lists methods and not that one, then client_secret_basic.
 */
export function tokenEndpointAuthMethod(provider: ExternalIdentityProvider, metadata: OidcMetadata): TokenEndpointAuthMethod {
  if (provider.tokenEndpointAuthMethod) {
    return provider.tokenEndpointAuthMethod;
  }
  if (!provider.clientSecret) {
    return 'none';
  }
  const supported = metadata.tokenEndpointAuthMethods;
  if (!supported || supported.length === 0 || supported.includes('client_secret_post')) {
    return 'client_secret_post';
  }
  return supported.includes('client_secret_basic') ? 'client_secret_basic' : 'client_secret_post';
}

/** Adds the client's credentials to a token request, as RFC 6749 section 2.3.1 describes for each method. */
function authenticateClient(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  body: URLSearchParams,
  headers: Record<string, string>,
) {
  const method = tokenEndpointAuthMethod(provider, metadata);
  if (method === 'client_secret_basic' && provider.clientSecret) {
    const credentials = `${encodeURIComponent(provider.clientId)}:${encodeURIComponent(provider.clientSecret)}`;
    headers['authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
    return;
  }
  body.set('client_id', provider.clientId);
  if (method === 'client_secret_post' && provider.clientSecret) {
    body.set('client_secret', provider.clientSecret);
  }
}

export async function exchangeCode(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  request: { code: string; callbackUrl: string; codeVerifier: string },
): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: request.code,
    redirect_uri: request.callbackUrl,
    code_verifier: request.codeVerifier,
  });
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  authenticateClient(provider, metadata, body, headers);

  const response = await fetch(metadata.tokenEndpoint, { method: 'POST', headers, body });
  if (!response.ok) {
    throw new Error(`The identity provider refused the authorization code: HTTP ${response.status}`);
  }

  const tokens = TokenResponseSchema.parse(await response.json());
  return {
    idToken: tokens.id_token,
    ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    ...(tokens.expires_in !== undefined ? { expiresIn: tokens.expires_in } : {}),
  };
}

/** Trades a refresh token for a new access token, authenticating the client the same way exchangeCode does. */
export async function refreshTokens(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  refreshToken: string,
): Promise<OidcRefreshedTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  authenticateClient(provider, metadata, body, headers);

  const response = await fetch(metadata.tokenEndpoint, { method: 'POST', headers, body });
  if (!response.ok) {
    throw new Error(`The identity provider refused the refresh token: HTTP ${response.status}`);
  }

  const tokens = RefreshResponseSchema.parse(await response.json());
  return {
    accessToken: tokens.access_token,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    ...(tokens.expires_in !== undefined ? { expiresIn: tokens.expires_in } : {}),
  };
}

const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keysFor(jwksUri: string) {
  let keys = jwksByUri.get(jwksUri);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(jwksUri));
    jwksByUri.set(jwksUri, keys);
  }
  return keys;
}

/** Verifies signature, issuer, audience, expiry and the nonce, and returns the claims. */
export async function verifyIdToken(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  idToken: string,
  expectedNonce: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, keysFor(metadata.jwksUri), {
    issuer: metadata.issuer,
    audience: provider.clientId,
    algorithms: ALLOWED_ALGORITHMS,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  });
  if (payload['nonce'] !== expectedNonce) {
    throw new Error('The ID token nonce does not match this login');
  }
  return payload;
}

/**
 * The claims of the userinfo endpoint, or undefined when the provider has none, answers with anything but a JSON
 * object (signed JWT responses are not supported), or names another subject than the ID token: the userinfo
 * response is only trusted for the subject that was authenticated (OpenID Connect Core section 5.3.2).
 */
export async function fetchUserinfo(
  metadata: OidcMetadata,
  accessToken: string,
  expectedSubject: string,
): Promise<JWTPayload | undefined> {
  if (!metadata.userinfoEndpoint) {
    return undefined;
  }
  const response = await fetch(metadata.userinfoEndpoint, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
    return undefined;
  }
  const parsed = z.looseObject({ sub: z.string() }).safeParse(await response.json());
  return parsed.success && parsed.data.sub === expectedSubject ? parsed.data : undefined;
}
