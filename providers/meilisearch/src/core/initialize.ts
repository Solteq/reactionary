import type { Cache, RequestContext } from '@reactionary/core';
import { OrderSearchResultSchema, ProductSearchResultSchema } from '@reactionary/core';
import { MeilisearchSearchProvider } from '../providers/product-search.provider.js';
import { MeilisearchProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';
import { MeilisearchOrderSearchProvider } from '../providers/order-search.provider.js';
import {
  MeilisearchCapabilitiesSchema,
  type MeilisearchCapabilities,
} from '../schema/capabilities.schema.js';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';
import { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import {
  type MeilisearchClientFromCapabilities,
  resolveCapabilityProvider,
  resolveProviderOnlyCapability,
} from './initialize.types.js';

export function withMeilisearchCapabilities<T extends MeilisearchCapabilities>(
  configuration: MeilisearchConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): MeilisearchClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const caps = MeilisearchCapabilitiesSchema.parse(capabilities);

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityProvider(
        capabilities.productSearch,
        {
          factory: new MeilisearchProductSearchFactory(ProductSearchResultSchema),
          provider: (args) =>
            new MeilisearchSearchProvider(
              args.config,
              args.cache,
              args.context,
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

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityProvider(
        capabilities.orderSearch,
        {
          factory: new MeilisearchOrderSearchFactory(OrderSearchResultSchema),
          provider: (args) =>
            new MeilisearchOrderSearchProvider(
              args.config,
              args.cache,
              args.context,
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

    if (caps.productRecommendations?.enabled) {
      client.productRecommendations = resolveProviderOnlyCapability(
        capabilities.productRecommendations,
        (args) =>
          new MeilisearchProductRecommendationsProvider(
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
