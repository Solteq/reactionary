import type { Cache, RequestContext } from '@reactionary/core';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { AlgoliaCapabilities } from '../schema/capabilities.schema.js';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { AlgoliaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import {
  type AlgoliaClientFromCapabilities,
  resolveCapabilityWithFactory,
  resolveDirectCapability,
} from './initialize.types.js';

export function withAlgoliaCapabilities<T extends AlgoliaCapabilities>(
  configuration: AlgoliaConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): AlgoliaClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};

    if (capabilities.productSearch?.enabled) {
      const defaultFactory = new AlgoliaProductSearchFactory(
        AlgoliaProductSearchResultSchema,
      );
      client.productSearch = resolveCapabilityWithFactory(
        capabilities.productSearch,
        {
          factory: defaultFactory,
          capability: (args) =>
            new AlgoliaProductSearchCapability(
              args.cache,
              args.context,
              args.config,
              args.factory,
            ),
        },
        (factory) => ({
          cache,
          context,
          config: configuration,
          factory,
        }),
      );
    }

    if (capabilities.analytics?.enabled) {
      client.analytics = resolveDirectCapability(
        capabilities.analytics,
        (args) => new AlgoliaAnalyticsCapability(args.cache, args.context, args.config),
        {
          cache,
          context,
          config: configuration,
        },
      );
    }

    if (capabilities.productRecommendations?.enabled) {
      client.productRecommendations = resolveDirectCapability(
        capabilities.productRecommendations,
        (args) =>
          new AlgoliaProductRecommendationsCapability(
            args.config,
            args.cache,
            args.context,
          ),
        {
          cache,
          context,
          config: configuration,
        },
      );
    }

    return client;
  };
}
