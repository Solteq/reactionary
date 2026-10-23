import {
  type Cache,
  type ExternalLoginRedirect,
  ExternalLoginRedirectSchema,
  type Identity,
  type IdentityConflictError,
  IdentityCapability,
  type IdentityMutationCompleteExternalLogin,
  IdentityMutationCompleteExternalLoginSchema,
  type IdentityMutationStartExternalLogin,
  IdentityMutationStartExternalLoginSchema,
  type IdentityProvider,
  IdentityProviderSchema,
  IdentityQueryProvidersSchema,
  IdentitySchema,
  PASSWORD_IDENTITY_PROVIDER,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import type { JWTPayload } from 'jose';
import { codeChallenge, randomToken } from '../client/pkce.js';
import { resolveMetadata } from '../client/discovery.js';
import { buildAuthorizationUrl, exchangeCode, verifyIdToken, type OidcTokens } from '../client/relying-party.js';
import type { ExternalIdentityProvider } from '../schema/external-identity-provider.schema.js';

export type ExchangeExternalIdentityInput = {
  provider: ExternalIdentityProvider;
  /** The verified ID token claims. */
  claims: JWTPayload;
  tokens: OidcTokens;
};

/**
 * Base class for backends that cannot run an external login themselves. This class runs the OpenID Connect part
 * (discovery, authorization code with PKCE, nonce, ID-token validation, binding the callback to the browser that
 * started it); the backend implements exchangeExternalIdentity to turn the verified identity into a backend session.
 */
export abstract class OidcIdentityCapability<TIdentity extends Identity = Identity> extends IdentityCapability<TIdentity> {
  protected readonly externalProviders: ExternalIdentityProvider[];

  constructor(cache: Cache, context: RequestContext, externalProviders: ExternalIdentityProvider[] | undefined) {
    super(cache, context);
    this.externalProviders = externalProviders ?? [];
  }

  /**
   * Creates (or finds) the backend customer for a verified external identity and establishes the backend session,
   * including whatever the backend needs so a guest cart carries over. Returns IdentityConflict when the backend
   * refuses to link the identity to an existing account.
   */
  protected abstract exchangeExternalIdentity(
    input: ExchangeExternalIdentityInput,
  ): Promise<Result<TIdentity, IdentityConflictError>>;

  @Reactionary({
    inputSchema: IdentityQueryProvidersSchema,
    outputSchema: IdentityProviderSchema.array(),
  })
  public override async listProviders(): Promise<Result<IdentityProvider[]>> {
    return success([
      PASSWORD_IDENTITY_PROVIDER,
      ...this.externalProviders.map((provider) => ({
        identifier: { key: provider.key },
        displayName: provider.displayName,
        flow: 'redirect' as const,
        ...(provider.brand ? { brand: provider.brand } : {}),
      })),
    ]);
  }

  @Reactionary({
    inputSchema: IdentityMutationStartExternalLoginSchema,
    outputSchema: ExternalLoginRedirectSchema,
  })
  public override async startExternalLogin(
    payload: IdentityMutationStartExternalLogin,
  ): Promise<Result<ExternalLoginRedirect>> {
    const provider = this.externalProviders.find((candidate) => candidate.key === payload.provider.key);
    if (!provider) {
      return error({ type: 'InvalidInput', error: `Unknown identity provider ${payload.provider.key}` });
    }

    const metadata = await resolveMetadata(provider);
    const state = randomToken();
    const nonce = randomToken();
    const codeVerifier = randomToken(48);
    const location = buildAuthorizationUrl(provider, metadata, {
      callbackUrl: payload.callbackUrl,
      state,
      nonce,
      codeChallenge: await codeChallenge(codeVerifier),
    });

    this.setPendingExternalLogin(provider.key, state, { nonce, codeVerifier });
    return success({ location });
  }

  @Reactionary({
    inputSchema: IdentityMutationCompleteExternalLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async completeExternalLogin(
    payload: IdentityMutationCompleteExternalLogin,
  ): Promise<Result<TIdentity, IdentityConflictError>> {
    const provider = this.externalProviders.find((candidate) => candidate.key === payload.provider.key);
    if (!provider) {
      return error({ type: 'InvalidInput', error: `Unknown identity provider ${payload.provider.key}` });
    }

    const params = payload.callbackParameters;
    const pending = this.takePendingExternalLogin(provider.key, params['state']);
    if (!pending) {
      return error({ type: 'InvalidInput', error: 'The login was not started in this session, or has expired' });
    }
    if (params['error']) {
      return error({ type: 'InvalidInput', error: `The identity provider refused the login: ${params['error']}` });
    }
    const code = params['code'];
    const { nonce, codeVerifier } = pending.data;
    if (!code || !nonce || !codeVerifier) {
      return error({ type: 'InvalidInput', error: 'The login response has no authorization code' });
    }

    const metadata = await resolveMetadata(provider);
    const tokens = await exchangeCode(provider, metadata, { code, callbackUrl: payload.callbackUrl, codeVerifier });
    const claims = await verifyIdToken(provider, metadata, tokens.idToken, nonce);

    if (provider.requireVerifiedEmail !== false && claims['email_verified'] !== true) {
      return error({ type: 'InvalidInput', error: 'The identity provider did not confirm a verified email address' });
    }

    const result = await this.exchangeExternalIdentity({ provider, claims, tokens });
    if (result.success) {
      this.updateIdentityContext(result.value);
    }
    return result;
  }
}
