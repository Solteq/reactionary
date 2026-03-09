import type { Cache, RequestContext } from '@reactionary/core';
import { AlgoliaProductSearchProvider } from '../providers/product-search.provider.js';
import type { AlgoliaCapabilities } from '../schema/capabilities.schema.js';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaAnalyticsProvider } from '../providers/analytics.provider.js';
import { AlgoliaProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import {
  type AlgoliaClientFromCapabilities,
  resolveCapabilityProvider,
  resolveProviderOnlyCapability,
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
      client.productSearch = resolveCapabilityProvider(
        capabilities.productSearch,
        {
          factory: defaultFactory,
          provider: (args) =>
            new AlgoliaProductSearchProvider(
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
      client.analytics = resolveProviderOnlyCapability(
        capabilities.analytics,
        (args) => new AlgoliaAnalyticsProvider(args.cache, args.context, args.config),
        {
          cache,
          context,
          config: configuration,
        },
      );
    }

    if (capabilities.productRecommendations?.enabled) {
      client.productRecommendations = resolveProviderOnlyCapability(
        capabilities.productRecommendations,
        (args) =>
          new AlgoliaProductRecommendationsProvider(
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
