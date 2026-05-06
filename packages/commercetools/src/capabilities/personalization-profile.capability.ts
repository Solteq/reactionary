import type {
  Cache,
  PersonalizationProfileFactory,
  PersonalizationProfileFactoryOutput,
  PersonalizationProfileFactoryWithOutput,
  PersonalizationProfileQueryGetProfile,
  NotFoundError,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  PersonalizationProfileCapability,
  PersonalizationProfileSchema,
  PersonalizationProfileQueryGetProfileSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';

const debug = createDebug('reactionary:commercetools:personalization-profile');

export class CommercetoolsPersonalizationProfileCapability<
  TFactory extends PersonalizationProfileFactory = CommercetoolsPersonalizationProfileFactory,
> extends PersonalizationProfileCapability<PersonalizationProfileFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: PersonalizationProfileFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: PersonalizationProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: PersonalizationProfileQueryGetProfileSchema,
    outputSchema: PersonalizationProfileSchema,
  })
  public override async getPersonalizationProfile(
    payload: PersonalizationProfileQueryGetProfile,
  ): Promise<Result<PersonalizationProfileFactoryOutput<TFactory>, NotFoundError>> {
    const identity = payload.identity;
    debug('getPersonalizationProfile', payload);

    if (identity.type === 'Anonymous') {
      return success(
        this.factory.parsePersonalizationProfile(this.context, {
          id: 'anonymous:',
          version: 0,
          createdAt: '',
          lastModifiedAt: '',
          email: '',
          addresses: [],
          isEmailVerified: false,
          authenticationMode: 'Password',
          customerGroupAssignments: [],
        }),
      );
    }
    if (identity.type === 'Guest') {
      return success(
        this.factory.parsePersonalizationProfile(this.context, {
          id: identity.id.userId ,
          version: 0,
          createdAt: '',
          lastModifiedAt: '',
          email: '',
          addresses: [],
          isEmailVerified: false,
          authenticationMode: 'Password',
          customerGroupAssignments: [],
        }),
      );
    }




    const client = await this.getClient();

    const response = await client
      .me()
      .get({
        queryArgs: {
          expand: ['customerGroupAssignments[*].customerGroup'],
        },
      })
      .execute();

    const model = this.factory.parsePersonalizationProfile(this.context, response.body);
    return success(model);
  }
}
