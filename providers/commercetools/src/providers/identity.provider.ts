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
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type z from 'zod';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsIdentityProvider extends IdentityProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(payload: IdentityQuerySelf): Promise<Identity> {
    const identity = await this.client.introspect();

    return identity;
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(payload: IdentityMutationLogin): Promise<Identity> {
    const identity = await this.client.login(
      payload.username,
      payload.password
    );

    return identity;
  }

  @Reactionary({
    outputSchema: IdentitySchema,
  })
  public override async logout(payload: Record<string, never>): Promise<Identity> {
    const identity = await this.client.logout();

    return identity;
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister
  ): Promise<Identity> {
    const identity = await this.client.register(
      payload.username,
      payload.password
    );

    return identity;
  }
}
