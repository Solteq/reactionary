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

export async function exchangeCode(
  provider: ExternalIdentityProvider,
  metadata: OidcMetadata,
  request: { code: string; callbackUrl: string; codeVerifier: string },
): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: request.code,
    redirect_uri: request.callbackUrl,
    client_id: provider.clientId,
    code_verifier: request.codeVerifier,
  });
  if (provider.clientSecret) {
    body.set('client_secret', provider.clientSecret);
  }

  const response = await fetch(metadata.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
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
