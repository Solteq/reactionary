import type {
  Profile,
  ProfileMutationUpdate,
  ProfileQuerySelf,
  RequestContext,
} from '@reactionary/core';
import { ProfileProvider } from '@reactionary/core';
import type z from 'zod';
import { CommercetoolsClient } from '../core/client.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Cache } from '@reactionary/core';
import type { Customer } from '@commercetools/platform-sdk';

export class CommercetoolsProfileProvider<
  T extends Profile = Profile
> extends ProfileProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  public override async getSelf(
    payload: ProfileQuerySelf,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);

    const remote = await client.me().get().execute();
    const model = this.parseSingle(remote.body, reqCtx);

    return model;
  }

  public override async update(
    payload: ProfileMutationUpdate,
    reqCtx: RequestContext
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }

  protected override parseSingle(body: Customer, reqCtx: RequestContext): T {
    const model = this.newModel();

    model.email = body.email;
    model.emailVerified = body.isEmailVerified;

    return model;
  }
}
