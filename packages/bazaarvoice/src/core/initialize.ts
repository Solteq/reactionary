import type { Cache, RequestContext } from '@reactionary/core';
import {
  ProductRatingSummarySchema,
  ProductReviewPaginatedResultSchema,
  ProductReviewSchema,
} from '@reactionary/core';
import { BazaarvoiceProductReviewsCapability } from '../capabilities/product-reviews.capability.js';
import { BazaarvoiceProductReviewsFactory } from '../factories/product-reviews/product-reviews.factory.js';
import type {
  BazaarvoiceCapabilities,
  BazaarvoiceProductReviewsCapabilityConfig,
} from '../schema/capabilities.schema.js';
import { BazaarvoiceCapabilitiesSchema } from '../schema/capabilities.schema.js';
import type { BazaarvoiceConfiguration } from '../schema/configuration.schema.js';
import { BazaarvoiceConfigurationSchema } from '../schema/configuration.schema.js';
import { BazaarvoiceClient } from './client.js';
import {
  type BazaarvoiceClientFromCapabilities,
  resolveCapabilityWithFactory,
} from './initialize.types.js';

export function withBazaarvoiceCapabilities<T extends BazaarvoiceCapabilities>(
  configuration: BazaarvoiceConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): BazaarvoiceClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};

    const config = BazaarvoiceConfigurationSchema.parse(configuration);
    const caps = BazaarvoiceCapabilitiesSchema.parse(capabilities);
    const bvClient = new BazaarvoiceClient(config, context);

    if (caps.productReviews?.enabled) {
      client.productReviews = resolveCapabilityWithFactory(
        capabilities.productReviews as
          | BazaarvoiceProductReviewsCapabilityConfig
          | undefined,
        {
          factory: new BazaarvoiceProductReviewsFactory(
            ProductRatingSummarySchema,
            ProductReviewSchema,
            ProductReviewPaginatedResultSchema,
          ),
          capability: (args) =>
            new BazaarvoiceProductReviewsCapability(
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
          client: bvClient,
          factory,
        }),
      );
    }

    return client;
  };
}
