import {
  type IdentityConflictError,
  type IdentityFactory,
  type IdentityFactoryOutput,
  type IdentityFactoryWithOutput,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  type IdentityMutationRegister,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  type Result,
  error,
  externalLoginResult,
  profileFromOidcClaims,
  success,
} from '@reactionary/core';
import { OidcIdentityCapability, type ExchangeExternalIdentityInput } from '@reactionary/oidc';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';

export class CommercetoolsIdentityCapability<
  TFactory extends IdentityFactory = CommercetoolsIdentityFactory,
> extends OidcIdentityCapability<IdentityFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: IdentityFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: IdentityFactoryWithOutput<TFactory>,
  ) {
    super(cache, context, config.externalIdentityProviders);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(payload: IdentityQuerySelf): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const identity = this.factory.parseIdentity(
      this.context,
      await this.commercetools.introspect(),
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(payload: IdentityMutationLogin): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const identity = this.factory.parseIdentity(
      this.context,
      await this.commercetools.login(
        payload.username,
        payload.password
      )
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    outputSchema: IdentitySchema,
  })
  public override async logout(payload: Record<string, never>): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const identity = this.factory.parseIdentity(
      this.context,
      await this.commercetools.logout(),
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const identity = this.factory.parseIdentity(
      this.context,
      await this.commercetools.register(
        payload.username,
        payload.password
      )
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }

  /**
   * The shared OpenID Connect client has verified the identity. commercetools gets the identity provider's access
   * token as the session token, so that is what must be present; the customer is found or created by externalId.
   */
  protected override async exchangeExternalIdentity(
    input: ExchangeExternalIdentityInput,
  ): Promise<Result<IdentityFactoryOutput<TFactory>, IdentityConflictError>> {
    const { claims, tokens, provider } = input;
    if (!tokens.accessToken) {
      return error({
        type: 'InvalidInput',
        error: 'The identity provider returned no access token, which commercetools needs',
      });
    }
    const text = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);
    const email = text(claims['email']);
    const issuer = text(claims.iss);
    const subject = text(claims.sub);
    if (!email || !issuer || !subject) {
      return error({
        type: 'InvalidInput',
        error: 'The identity provider did not return an email address, issuer and subject',
      });
    }

    const names = profileFromOidcClaims(claims);
    const outcome = await this.commercetools.loginWithExternalIdentity({
      provider,
      externalId: `${issuer}|${subject}`,
      email,
      ...(names.firstName ? { firstName: names.firstName } : {}),
      ...(names.lastName ? { lastName: names.lastName } : {}),
      tokens: { ...tokens, accessToken: tokens.accessToken },
    });
    if (outcome.type === 'Conflict') {
      return error({ type: 'IdentityConflict', message: outcome.message });
    }

    return success(
      this.factory.parseIdentity(this.context, {
        type: 'Registered',
        id: { userId: outcome.customerId },
        externalLogin: externalLoginResult(claims, outcome.created),
      }),
    );
  }
}
