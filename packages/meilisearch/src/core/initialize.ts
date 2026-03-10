import type { Cache, RequestContext } from '@reactionary/core';
import { OrderSearchResultSchema, ProductSearchResultSchema } from '@reactionary/core';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { MeilisearchOrderSearchCapability } from '../capabilities/order-search.capability.js';
import {
  MeilisearchCapabilitiesSchema,
  type MeilisearchCapabilities,
} from '../schema/capabilities.schema.js';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';
import { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import {
  type MeilisearchClientFromCapabilities,
  resolveCapabilityWithFactory,
  resolveDirectCapability,
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
      client.productSearch = resolveCapabilityWithFactory(
        capabilities.productSearch,
        {
          factory: new MeilisearchProductSearchFactory(ProductSearchResultSchema),
          capability: (args) =>
            new MeilisearchProductSearchCapability(
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
      client.orderSearch = resolveCapabilityWithFactory(
        capabilities.orderSearch,
        {
          factory: new MeilisearchOrderSearchFactory(OrderSearchResultSchema),
          capability: (args) =>
            new MeilisearchOrderSearchCapability(
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
      client.productRecommendations = resolveDirectCapability(
        capabilities.productRecommendations,
        (args) =>
          new MeilisearchProductRecommendationsCapability(
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
