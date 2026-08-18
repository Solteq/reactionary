import type {
  Cache,
  ProductReviewsCapability,
  ProductReviewsFactory,
  ProductReviewsFactoryWithOutput,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { LipscoreConfiguration } from './configuration.schema.js';
import type { LipscoreClient } from '../core/client.js';
import * as z from 'zod';

const ProductReviewsCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

export const LipscoreCapabilitiesSchema = CapabilitiesSchema.pick({
  productReviews: true,
})
  .extend({
    productReviews: ProductReviewsCapabilitySchema.optional(),
  })
  .partial();

export type LipscoreCapabilities = z.infer<typeof LipscoreCapabilitiesSchema>;

// ---------------------------------------------------------------------------
// Per-capability factory args and config types
// ---------------------------------------------------------------------------

export interface LipscoreCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: LipscoreConfiguration;
}

export interface LipscoreProductReviewsCapabilityFactoryArgs<
  TFactory extends ProductReviewsFactory = ProductReviewsFactory,
> extends LipscoreCapabilityFactoryArgs {
  client: LipscoreClient;
  factory: ProductReviewsFactoryWithOutput<TFactory>;
}

export interface LipscoreProductReviewsCapabilityConfig<
  TFactory extends ProductReviewsFactory = ProductReviewsFactory,
  TCapability extends ProductReviewsCapability = ProductReviewsCapability,
> {
  enabled: boolean;
  factory?: ProductReviewsFactoryWithOutput<TFactory>;
  capability?: (
    args: LipscoreProductReviewsCapabilityFactoryArgs<TFactory>,
  ) => TCapability;
}
