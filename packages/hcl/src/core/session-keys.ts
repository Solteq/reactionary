/**
 * Session key constants for WCS auth data stored in RequestContext.session.
 * All keys use the `hcl.` prefix per provider convention.
 *
 * Centralised here so that both HclTransactionClient (which reads them to build
 * auth headers) and HclIdentityCapability (which writes them after login/logout)
 * use the exact same string values.
 */
export const SESSION_KEY_WC_TOKEN = 'hcl.WCToken';
export const SESSION_KEY_WC_TRUSTED_TOKEN = 'hcl.WCTrustedToken';
export const SESSION_KEY_USER_ID = 'hcl.userId';
export const SESSION_KEY_IDENTITY_TYPE = 'hcl.identityType';
export const SESSION_KEY_PERSONALIZATION_ID = 'hcl.personalizationID';
