import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityProvider,
  type IdentityMutationRegister,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema';
import type z from 'zod';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsIdentityProvider<
  T extends Identity = Identity
> extends IdentityProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  public override async getSelf(
    payload: IdentityQuerySelf,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.assert(reqCtx.identity as T);
  }

  public override async login(
    payload: IdentityMutationLogin,
    reqCtx: RequestContext
  ): Promise<T> {
    await new CommercetoolsClient(this.config).login(payload.username, payload.password, reqCtx);

    return this.getSelf({}, reqCtx);
  }

  public override async logout(
    payload: Record<string, never>,
    reqCtx: RequestContext
  ): Promise<T> {
    await new CommercetoolsClient(this.config).logout(reqCtx);

    return this.getSelf({}, reqCtx);
  }

  public override async register(
    payload: IdentityMutationRegister,
    reqCtx: RequestContext
  ): Promise<T> {
    await new CommercetoolsClient(this.config).register(payload.username, payload.password, reqCtx);

    return this.getSelf({}, reqCtx);
  }
}
