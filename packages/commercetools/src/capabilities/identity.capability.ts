import {
  type IdentityFactory,
  type IdentityFactoryOutput,
  type IdentityFactoryWithOutput,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityCapability,
  type IdentityMutationRegister,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  type Result,
  success,
  type ExternalLoginRedirect,
  ExternalLoginRedirectSchema,
  type IdentityConflictError,
  type IdentityMutationCompleteExternalLogin,
  IdentityMutationCompleteExternalLoginSchema,
  type IdentityMutationStartExternalLogin,
  IdentityMutationStartExternalLoginSchema,
  type IdentityProvider,
  IdentityProviderSchema,
  type IdentityQueryProviders,
  IdentityQueryProvidersSchema,
  PASSWORD_IDENTITY_PROVIDER,
  error,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';

export class CommercetoolsIdentityCapability<
  TFactory extends IdentityFactory = CommercetoolsIdentityFactory,
> extends IdentityCapability<IdentityFactoryOutput<TFactory>> {
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
    super(cache, context);

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

  @Reactionary({
    inputSchema: IdentityQueryProvidersSchema,
    outputSchema: IdentityProviderSchema.array(),
  })
  public override async listProviders(
    _payload: IdentityQueryProviders,
  ): Promise<Result<IdentityProvider[]>> {
    return success([PASSWORD_IDENTITY_PROVIDER]);
  }

  @Reactionary({
    inputSchema: IdentityMutationStartExternalLoginSchema,
    outputSchema: ExternalLoginRedirectSchema,
  })
  public override async startExternalLogin(
    _payload: IdentityMutationStartExternalLogin,
  ): Promise<Result<ExternalLoginRedirect>> {
    return error({ type: 'InvalidInput', error: 'External login is not supported by commercetools' });
  }

  @Reactionary({
    inputSchema: IdentityMutationCompleteExternalLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async completeExternalLogin(
    _payload: IdentityMutationCompleteExternalLogin,
  ): Promise<Result<IdentityFactoryOutput<TFactory>, IdentityConflictError>> {
    return error({ type: 'InvalidInput', error: 'External login is not supported by commercetools' });
  }
}
