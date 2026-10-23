// Brands recognised in a provider id, by the segments the standard Auth0 connection names use.
// e.g. oidc-auth0-google-oauth2 -> google, oidc-auth0-windowslive -> microsoft.
const BRAND_BY_SEGMENT: Record<string, string> = {
  google: 'google',
  apple: 'apple',
  amazon: 'amazon',
  facebook: 'facebook',
  github: 'github',
  linkedin: 'linkedin',
  twitter: 'twitter',
  microsoft: 'microsoft',
  windowslive: 'microsoft',
  azure: 'microsoft',
  entra: 'microsoft',
  emailpass: 'email',
  username: 'email', // Username-Password-Authentication, Auth0's database connection
};

/**
 * The brand of a Medusa auth provider, for the storefront to pick an icon. An explicit mapping wins;
 * otherwise it is guessed from the provider id. Returns undefined when nothing matches.
 */
export function brandForProvider(
  providerId: string,
  configured: Record<string, string> = {}
): string | undefined {
  const explicit = configured[providerId];
  if (explicit) {
    return explicit;
  }
  for (const segment of providerId.toLowerCase().split('-')) {
    const brand = BRAND_BY_SEGMENT[segment];
    if (brand) {
      return brand;
    }
  }
  return undefined;
}
