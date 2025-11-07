import type {
  Profile,
  ProfileMutationUpdate,
  ProfileQuerySelf,
  RequestContext,
} from '@reactionary/core';
import { ProfileProvider } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Cache } from '@reactionary/core';
import type { Customer } from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsProfileProvider<
  T extends Profile = Profile
> extends ProfileProvider<T> {
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

  protected async getClient() {
    const client = await this.client.getClient();
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
