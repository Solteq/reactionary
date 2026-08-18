import type { Cache, RequestContext } from '@reactionary/core';
import {
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
} from '@reactionary/core';
import { LipscoreProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { LipscoreProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type {
  LipscoreCapabilities,
  LipscoreProductReviewsCapabilityConfig,
} from '../schema/capabilities.schema.js';
import { LipscoreCapabilitiesSchema } from '../schema/capabilities.schema.js';
import type { LipscoreConfiguration } from '../schema/configuration.schema.js';
import { LipscoreConfigurationSchema } from '../schema/configuration.schema.js';
import { LipscoreClient } from './client.js';
import {
  type LipscoreClientFromCapabilities,
  resolveCapabilityWithFactory,
} from './initialize.types.js';

export function withLipscoreCapabilities<T extends LipscoreCapabilities>(
  configuration: LipscoreConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): LipscoreClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};

    const config = LipscoreConfigurationSchema.parse(configuration);
    const caps = LipscoreCapabilitiesSchema.parse(capabilities);
    const lipscoreClient = new LipscoreClient(config, context);

    if (caps.productReviews?.enabled) {
      client.productReviews = resolveCapabilityWithFactory(
        capabilities.productReviews as
          | LipscoreProductReviewsCapabilityConfig
          | undefined,
        {
          factory: new LipscoreProductReviewsFactory(
            ProductRatingSummarySchema,
            ProductReviewSchema,
            ProductReviewPaginatedResultSchema,
          ),
          capability: (args) =>
            new LipscoreProductReviewsCapability(
              args.cache,
              args.context,
              args.config,
              args.client,
              args.factory,
            ),
        },
        (factory) => ({
          cache,
          context,
          config,
          client: lipscoreClient,
          factory,
        }),
      );
    }

    return client;
  };
}
