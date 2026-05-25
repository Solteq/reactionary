import type {
  Cache,
  ProductReviewsCapability,
  ProductReviewsFactory,
  ProductReviewsFactoryWithOutput,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { BazaarvoiceConfiguration } from './configuration.schema.js';
import type { BazaarvoiceClient } from '../core/client.js';
import * as z from 'zod';

const ProductReviewsCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

export const BazaarvoiceCapabilitiesSchema = CapabilitiesSchema.pick({
  productReviews: true,
})
  .extend({
    productReviews: ProductReviewsCapabilitySchema.optional(),
  })
  .partial();

export type BazaarvoiceCapabilities = z.infer<
  typeof BazaarvoiceCapabilitiesSchema
>;

// ---------------------------------------------------------------------------
// Per-capability factory args and config types
// ---------------------------------------------------------------------------

export interface BazaarvoiceCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: BazaarvoiceConfiguration;
}

export interface BazaarvoiceProductReviewsCapabilityFactoryArgs<
  TFactory extends ProductReviewsFactory = ProductReviewsFactory,
> extends BazaarvoiceCapabilityFactoryArgs {
  client: BazaarvoiceClient;
  factory: ProductReviewsFactoryWithOutput<TFactory>;
}

export interface BazaarvoiceProductReviewsCapabilityConfig<
  TFactory extends ProductReviewsFactory = ProductReviewsFactory,
  TCapability extends ProductReviewsCapability = ProductReviewsCapability,
> {
  enabled: boolean;
  factory?: ProductReviewsFactoryWithOutput<TFactory>;
  capability?: (
    args: BazaarvoiceProductReviewsCapabilityFactoryArgs<TFactory>,
  ) => TCapability;
}
