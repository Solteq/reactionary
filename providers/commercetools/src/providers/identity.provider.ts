import {
  type IdentityFactory,
  type IdentityFactoryOutput,
  type IdentityFactoryWithOutput,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityProvider,
  type IdentityMutationRegister,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  type Result,
  success,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsIdentityFactory } from '../factories/identity/identity.factory.js';

export class CommercetoolsIdentityProvider<
  TFactory extends IdentityFactory = CommercetoolsIdentityFactory,
> extends IdentityProvider<IdentityFactoryOutput<TFactory>> {
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
}
