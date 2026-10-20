import type {
  Cache,
  NotFoundError,
  PersonalizationProfileFactory,
  PersonalizationProfileFactoryOutput,
  PersonalizationProfileFactoryWithOutput,
  PersonalizationProfileQueryGetProfile,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  PersonalizationProfileCapability,
  PersonalizationProfileQueryGetProfileSchema,
  PersonalizationProfileSchema,
  Reactionary,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import { CUSTOMER_SEGMENTS_QUERY } from '../core/personalization.graphql.js';
import type { MagentoPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import {
  MAGENTO_NOT_LOGGED_IN_GROUP_ID,
  MagentoCustomerGroupSchema,
  MagentoCustomerSegmentsResponseSchema,
} from '../schema/personalization.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:personalization-profile');

/**
 * Builds a personalization profile from the shopper's Magento customer group
 * and, on Adobe Commerce, customer segments.
 *
 * - Signed-in customers: the group comes from `customers/me` (customer token).
 *   A `Registered` identity whose user id doesn't match the token's customer
 *   is reported as `NotFound`.
 * - Everyone else: the NOT LOGGED IN group (id 0).
 * - `personalizationResolveGroupCodes`: also resolves the group code through
 *   admin REST, using only the id Magento itself reported.
 * - `personalizationIncludeSegments`: adds Adobe Commerce customer segments.
 *   Magento resolves them per cart, so they are only looked up when the
 *   session holds a masked cart id.
 */
export class MagentoPersonalizationProfileCapability<
  TFactory extends PersonalizationProfileFactory = MagentoPersonalizationProfileFactory,
> extends PersonalizationProfileCapability<PersonalizationProfileFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: PersonalizationProfileFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: PersonalizationProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async resolveGroupCode(groupId: number): Promise<string | undefined> {
    if (!this.config.personalizationResolveGroupCodes) {
      return undefined;
    }
    const data = await this.magentoApi.adminRequest<unknown>(
      'GET',
      `/V1/customerGroups/${encodeURIComponent(String(groupId))}`,
    );
    return MagentoCustomerGroupSchema.parse(data).code;
  }

  protected async resolveSegmentUids(): Promise<string[]> {
    if (!this.config.personalizationIncludeSegments) {
      return [];
    }
    const cartId = await this.magentoApi.getActiveCartId();
    // Numeric ids are REST quote ids, which the GraphQL query does not accept.
    if (!cartId || /^\d+$/.test(cartId)) {
      debug('no masked cart id in the session; customer segments not resolved');
      return [];
    }
    const data = await this.magentoApi.graphqlRequest<unknown>(CUSTOMER_SEGMENTS_QUERY, { cartId });
    return (MagentoCustomerSegmentsResponseSchema.parse(data).customerSegments ?? []).flatMap(
      (segment) => (segment ? [segment.uid] : []),
    );
  }

  @Reactionary({
    inputSchema: PersonalizationProfileQueryGetProfileSchema,
    outputSchema: PersonalizationProfileSchema,
  })
  public override async getPersonalizationProfile(
    payload: PersonalizationProfileQueryGetProfile,
  ): Promise<Result<PersonalizationProfileFactoryOutput<TFactory>, NotFoundError>> {
    const identity = payload.identity;

    try {
      let customerId = 'anonymous';
      let groupId: number | undefined = MAGENTO_NOT_LOGGED_IN_GROUP_ID;

      if (identity.type === 'Registered') {
        const me = await this.magentoApi.getMe();
        if (identity.id.userId && identity.id.userId !== String(me.id)) {
          return error<NotFoundError>({
            type: 'NotFound',
            identifier: payload.personalizationProfileIdentifier ?? { key: identity.id.userId },
          });
        }
        customerId = String(me.id);
        groupId = me.group_id;
      }

      const groupCode = groupId === undefined ? undefined : await this.resolveGroupCode(groupId);
      const segmentUids = await this.resolveSegmentUids();

      return success(
        this.factory.parsePersonalizationProfile(this.context, {
          customerId,
          groupId,
          groupCode,
          segmentUids,
        }),
      );
    } catch (err) {
      return handleMagentoProviderError(
        'get personalization profile',
        err,
        payload.personalizationProfileIdentifier,
      );
    }
  }
}
