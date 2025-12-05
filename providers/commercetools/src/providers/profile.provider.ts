import type {
  Profile,
  ProfileMutationUpdate,
  ProfileQuerySelf,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  ProfileMutationUpdateSchema,
  ProfileProvider,
  ProfileQuerySelfSchema,
  ProfileSchema,
  Reactionary,
  success,
  error
} from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Cache } from '@reactionary/core';
import type { Customer } from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsProfileProvider extends ProfileProvider {
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

  protected async getClient() {
    const client = await this.client.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: ProfileQuerySelfSchema,
    outputSchema: ProfileSchema,
  })
  public override async getSelf(payload: ProfileQuerySelf): Promise<Result<Profile>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    const model = this.parseSingle(remote.body);

    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public override async update(payload: ProfileMutationUpdate): Promise<Result<Profile>> {
    throw new Error('Method not implemented.');
  }

  protected parseSingle(body: Customer): Profile {
    const email = body.email;
    const emailVerified = body.isEmailVerified;

    const result = {
      identifier: {
        userId: ''
      },
      email,
      emailVerified,
      alternateShippingAddresses: [],
      createdAt: '',
      meta: {
        cache: {
          hit: false,
          key: ''
        },
        placeholder: false
      },
      phone: '',
      phoneVerified: false,
      updatedAt: ''
    } satisfies Profile;

    return result;
  }
}
