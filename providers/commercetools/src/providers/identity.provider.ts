import {
  type Identity,
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

export class CommercetoolsIdentityProvider extends IdentityProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(payload: IdentityQuerySelf): Promise<Result<Identity>> {
    const identity = await this.commercetools.introspect();

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(payload: IdentityMutationLogin): Promise<Result<Identity>> {
    const identity = await this.commercetools.login(
      payload.username,
      payload.password
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    outputSchema: IdentitySchema,
  })
  public override async logout(payload: Record<string, never>): Promise<Result<Identity>> {
    const identity = await this.commercetools.logout();

    this.updateIdentityContext(identity);

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister
  ): Promise<Result<Identity>> {
    const identity = await this.commercetools.register(
      payload.username,
      payload.password
    );

    this.updateIdentityContext(identity);

    return success(identity);
  }
}
