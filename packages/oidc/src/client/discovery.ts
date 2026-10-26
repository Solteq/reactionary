import * as z from 'zod';
import type { ExternalIdentityProvider } from '../schema/external-identity-provider.schema.js';

const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export type OidcMetadata = {
  /** The value ID tokens must carry in their iss claim. */
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  endSessionEndpoint?: string;
  userinfoEndpoint?: string;
  /** token_endpoint_auth_methods_supported, when the provider lists it. */
  tokenEndpointAuthMethods?: string[];
};

const DiscoveryDocumentSchema = z.looseObject({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  jwks_uri: z.string(),
  end_session_endpoint: z.string().optional(),
  userinfo_endpoint: z.string().optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});

const cache = new Map<string, { expires: number; metadata: OidcMetadata }>();

export function clearDiscoveryCache() {
  cache.clear();
}

/**
 * The endpoints of a provider, from its discovery document. When all three endpoints are configured discovery is
 * skipped, which is how providers whose discovery URL differs from their issuer (Azure B2C) are supported.
 * Configured endpoints win over discovered ones; the configured issuer is always the expected iss.
 */
export async function resolveMetadata(provider: ExternalIdentityProvider): Promise<OidcMetadata> {
  if (provider.authorizationEndpoint && provider.tokenEndpoint && provider.jwksUri) {
    return {
      issuer: provider.issuer,
      authorizationEndpoint: provider.authorizationEndpoint,
      tokenEndpoint: provider.tokenEndpoint,
      jwksUri: provider.jwksUri,
      ...(provider.userinfoEndpoint ? { userinfoEndpoint: provider.userinfoEndpoint } : {}),
    };
  }

  let discovered = cache.get(provider.issuer);
  if (!discovered || discovered.expires < Date.now()) {
    const url = `${provider.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Discovery failed for ${provider.key}: HTTP ${response.status}`);
    }
    const document = DiscoveryDocumentSchema.parse(await response.json());
    // OpenID Connect Discovery requires the document's issuer to equal the URL it was fetched for.
    if (document.issuer !== provider.issuer) {
      throw new Error(`Discovery document of ${provider.key} names a different issuer than configured`);
    }
    discovered = {
      expires: Date.now() + DISCOVERY_TTL_MS,
      metadata: {
        issuer: document.issuer,
        authorizationEndpoint: document.authorization_endpoint,
        tokenEndpoint: document.token_endpoint,
        jwksUri: document.jwks_uri,
        ...(document.end_session_endpoint ? { endSessionEndpoint: document.end_session_endpoint } : {}),
        ...(document.userinfo_endpoint ? { userinfoEndpoint: document.userinfo_endpoint } : {}),
        ...(document.token_endpoint_auth_methods_supported
          ? { tokenEndpointAuthMethods: document.token_endpoint_auth_methods_supported }
          : {}),
      },
    };
    cache.set(provider.issuer, discovered);
  }

  return {
    ...discovered.metadata,
    authorizationEndpoint: provider.authorizationEndpoint ?? discovered.metadata.authorizationEndpoint,
    tokenEndpoint: provider.tokenEndpoint ?? discovered.metadata.tokenEndpoint,
    jwksUri: provider.jwksUri ?? discovered.metadata.jwksUri,
    ...(provider.userinfoEndpoint ?? discovered.metadata.userinfoEndpoint
      ? { userinfoEndpoint: (provider.userinfoEndpoint ?? discovered.metadata.userinfoEndpoint) as string }
      : {}),
  };
}
