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
    cache: Cache,
    context: RequestContext
  ) {
    super(schema, cache, context);

    this.config = config;
  }

  protected async getClient() {
    const client = await new CommercetoolsClient(this.config).getClient(this.context);
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  public override async getSelf(
    payload: ProfileQuerySelf
  ): Promise<T> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    const model = this.parseSingle(remote.body);

    return model;
  }

  public override async update(
    payload: ProfileMutationUpdate
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }

  protected override parseSingle(body: Customer): T {
    const model = this.newModel();

    model.email = body.email;
    model.emailVerified = body.isEmailVerified;

    return model;
  }
}
