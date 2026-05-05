import type {
  Cache,
  MarketingProfileFactory,
  MarketingProfileFactoryOutput,
  MarketingProfileFactoryWithOutput,
  MarketingProfileQueryGetProfile,
  NotFoundError,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  MarketingProfileCapability,
  MarketingProfileSchema,
  MarketingProfileQueryGetProfileSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsMarketingProfileFactory } from '../factories/marketing-profile/marketing-profile.factory.js';

const debug = createDebug('reactionary:commercetools:marketing-profile');

export class CommercetoolsMarketingProfileCapability<
  TFactory extends MarketingProfileFactory = CommercetoolsMarketingProfileFactory,
> extends MarketingProfileCapability<MarketingProfileFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: MarketingProfileFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: MarketingProfileFactoryWithOutput<TFactory>,
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
    inputSchema: MarketingProfileQueryGetProfileSchema,
    outputSchema: MarketingProfileSchema,
  })
  public override async getMarketingProfile(
    payload: MarketingProfileQueryGetProfile,
  ): Promise<Result<MarketingProfileFactoryOutput<TFactory>, NotFoundError>> {
    const identity = payload.identity;
    debug('getMarketingProfile', payload);

    if (identity.type === 'Anonymous') {
      return success(
        this.factory.parseMarketingProfile(this.context, {
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
        this.factory.parseMarketingProfile(this.context, {
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

    const model = this.factory.parseMarketingProfile(this.context, response.body);
    return success(model);
  }
}
