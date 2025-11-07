import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityProvider,
  type IdentityMutationRegister,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type z from 'zod';
import { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsIdentityProvider<
  T extends Identity = Identity
> extends IdentityProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  public override async getSelf(
    payload: IdentityQuerySelf
  ): Promise<T> {
    const client = await new CommercetoolsClient(this.config);
    const identity = await client.introspect(this.context);

    return identity as T;
  }

  public override async login(
    payload: IdentityMutationLogin
  ): Promise<T> {
    const identity = await new CommercetoolsClient(this.config).login(
      payload.username,
      payload.password,
      this.context
    );

    return identity as T;
  }

  public override async logout(
    payload: Record<string, never>
  ): Promise<T> {
    const identity = await new CommercetoolsClient(this.config).logout(this.context);

    return identity as T;
  }

  public override async register(
    payload: IdentityMutationRegister
  ): Promise<T> {
    const identity = await new CommercetoolsClient(this.config).register(
      payload.username,
      payload.password,
      this.context
    );

    return identity as T;
  }
}
