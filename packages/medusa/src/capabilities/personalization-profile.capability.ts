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
  Reactionary,
  PersonalizationProfileQueryGetProfileSchema,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import type { MedusaPersonalizationProfileFactory, MedusaCustomerGroup } from '../factories/personalization-profile/personalization-profile.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:personalization-profile');

export class MedusaPersonalizationProfileCapability<
  TFactory extends PersonalizationProfileFactory = MedusaPersonalizationProfileFactory,
> extends PersonalizationProfileCapability<PersonalizationProfileFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: PersonalizationProfileFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: PersonalizationProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected filterGroup(_group: MedusaCustomerGroup): boolean {
    return true;
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

    if (identity.type !== 'Registered') {
      return success(
        this.factory.parsePersonalizationProfile(this.context, {
          customerId: 'anonymous',
          groups: [],
        }),
      );
    }

    const customerId = identity.id.userId;

    const adminClient = await new MedusaAdminAPI(
      this.config,
      this.context,
    ).getClient();

    const customerResponse = await adminClient.admin.customer.retrieve(
      customerId,
      { fields: '+groups,+groups.name' },
    );

    const customer = customerResponse.customer;
    const groups: MedusaCustomerGroup[] = ((customer as unknown as Record<string, unknown>)['groups'] as MedusaCustomerGroup[] | undefined ?? [])
      .filter((g) => this.filterGroup(g));

    const model = this.factory.parsePersonalizationProfile(this.context, {
      customerId,
      groups,
    });

    return success(model);
  }
}
