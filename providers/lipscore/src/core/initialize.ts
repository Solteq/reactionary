import type {
  Cache,
  RequestContext,
  ClientFromCapabilities,
} from '@reactionary/core';
import { LipscoreProductReviewsProvider } from '../providers/product-reviews.provider.js';
import {
  LipscoreConfigurationSchema,
  type LipscoreConfiguration,
} from '../schema/configuration.schema.js';
import {
  LipscoreCapabilitiesSchema,
  type LipscoreCapabilities,
} from '../schema/capabilities.schema.js';

export function withLipscoreCapabilities<T extends LipscoreCapabilities>(
  configuration: LipscoreConfiguration,
  capabilities: T
) {
  return (
    cache: Cache,
    context: RequestContext
  ): ClientFromCapabilities<T> => {
    const client: any = {};
    const config = LipscoreConfigurationSchema.parse(configuration);
    const caps = LipscoreCapabilitiesSchema.parse(capabilities);

    if (caps.productReviews) {
      client.productReviews = new LipscoreProductReviewsProvider(
        config,
        cache,
        context
      );
    }

    return client;
  };
}
