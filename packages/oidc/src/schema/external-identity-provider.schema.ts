import * as z from 'zod';

/** Authorization request parameters that carry the security of the flow or its shape; configuration must not replace them. */
export const RESERVED_AUTHORIZATION_PARAMS = [
  'client_id',
  'response_type',
  'redirect_uri',
  'scope',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
];

export const DEFAULT_SCOPES = ['openid', 'email', 'profile'];

/** https everywhere except loopback, which is what local development and tests use. */
function isSecureUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

const secureUrlSchema = z.url().refine(isSecureUrl, { error: 'Must be an https URL (http is only allowed for localhost)' });

/**
 * An OpenID Connect identity provider a backend accepts logins from, for backends that cannot list their own.
 * Defaults (scopes, requireVerifiedEmail) are applied where they are used rather than here, so that this type
 * can be written as a plain object in a backend's configuration.
 */
export const ExternalIdentityProviderSchema = z.looseObject({
  key: z.string().min(1).meta({ description: 'Stable identifier the storefront passes back to startExternalLogin.' }),
  displayName: z.string().min(1),
  brand: z.string().optional().meta({ description: 'Neutral brand slug (google, apple, ...) so a storefront can choose its own icon.' }),
  issuer: secureUrlSchema.meta({ description: 'The issuer URL. Used for discovery and as the expected iss claim.' }),
  clientId: z.string().min(1),
  clientSecret: z.string().optional().meta({ description: 'Without a secret the client is public and relies on PKCE alone.' }),
  scopes: z.array(z.string()).optional().meta({ description: `Defaults to ${DEFAULT_SCOPES.join(' ')}.` }),
  authorizationParams: z
    .record(z.string(), z.string())
    .refine((params) => Object.keys(params).every((key) => !RESERVED_AUTHORIZATION_PARAMS.includes(key)), {
      error: `authorizationParams cannot set ${RESERVED_AUTHORIZATION_PARAMS.join(', ')}`,
    })
    .optional()
    .meta({ description: 'Fixed extra authorize parameters, e.g. { prompt: "login" } or { connection: "apple" } for Auth0.' }),
  requireVerifiedEmail: z.boolean().optional().meta({ description: 'Require email_verified to be true. Defaults to true; some providers (Azure B2C) never send the claim.' }),
  tokenEndpointAuthMethod: z
    .enum(['client_secret_basic', 'client_secret_post', 'none'])
    .optional()
    .meta({ description: 'How the client authenticates at the token endpoint. Defaults to none without a secret, otherwise to what discovery lists, preferring client_secret_post and falling back to client_secret_basic.' }),
  userinfo: z
    .enum(['never', 'when-missing', 'always'])
    .optional()
    .meta({ description: 'Whether to fetch claims from the userinfo endpoint. Defaults to when-missing: only when the ID token lacks the email, a name or email_verified. ID token claims always win over userinfo claims.' }),
  authorizationEndpoint: secureUrlSchema.optional(),
  tokenEndpoint: secureUrlSchema.optional(),
  jwksUri: secureUrlSchema.optional(),
  userinfoEndpoint: secureUrlSchema.optional(),
});

export type ExternalIdentityProvider = z.infer<typeof ExternalIdentityProviderSchema>;
