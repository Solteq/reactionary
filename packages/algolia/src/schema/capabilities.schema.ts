import type {
  AnalyticsCapability,
  Cache,
  ProductRecommendationsCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { AlgoliaConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const ProductSearchCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

const CapabilityOverrideSchema = z.looseObject({
  enabled: z.boolean(),
  capability: z.unknown().optional(),
});

export const AlgoliaCapabilitiesSchema = CapabilitiesSchema.pick({
  productSearch: true,
  analytics: true,
  productRecommendations: true,
})
  .extend({
    productSearch: ProductSearchCapabilitySchema.optional(),
    analytics: CapabilityOverrideSchema.optional(),
    productRecommendations: CapabilityOverrideSchema.optional(),
  })
  .partial();

export interface AlgoliaCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: AlgoliaConfiguration;
}

export interface AlgoliaProductSearchCapabilityFactoryArgs<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
> extends AlgoliaCapabilityFactoryArgs {
  factory: ProductSearchFactoryWithOutput<TFactory>;
}

export interface AlgoliaProductSearchCapabilityConfig<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
  TCapability extends ProductSearchCapability = ProductSearchCapability,
> {
  enabled: boolean;
  factory?: ProductSearchFactoryWithOutput<TFactory>;
  capability?: (args: AlgoliaProductSearchCapabilityFactoryArgs<TFactory>) => TCapability;
}

export interface AlgoliaAnalyticsCapabilityConfig<
  TCapability extends AnalyticsCapability = AnalyticsCapability,
> {
  enabled: boolean;
  capability?: (args: AlgoliaCapabilityFactoryArgs) => TCapability;
}

export interface AlgoliaProductRecommendationsCapabilityConfig<
  TCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
> {
  enabled: boolean;
  capability?: (args: AlgoliaCapabilityFactoryArgs) => TCapability;
}

export type AlgoliaCapabilities<
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchCapability extends ProductSearchCapability = ProductSearchCapability,
  TAnalyticsCapability extends AnalyticsCapability = AnalyticsCapability,
  TProductRecommendationsCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
> = {
  productSearch?: AlgoliaProductSearchCapabilityConfig<
    TProductSearchFactory,
    TProductSearchCapability
  >;
  analytics?: AlgoliaAnalyticsCapabilityConfig<TAnalyticsCapability>;
  productRecommendations?: AlgoliaProductRecommendationsCapabilityConfig<TProductRecommendationsCapability>;
};
