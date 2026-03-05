import type {
  AnalyticsProvider,
  Cache,
  ProductRecommendationsProvider,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchProvider,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { AlgoliaConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const ProductSearchCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  provider: z.unknown().optional(),
});

const ProviderCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  provider: z.unknown().optional(),
});

export const AlgoliaCapabilitiesSchema = CapabilitiesSchema.pick({
  productSearch: true,
  analytics: true,
  productRecommendations: true,
})
  .extend({
    productSearch: ProductSearchCapabilitySchema.optional(),
    analytics: ProviderCapabilitySchema.optional(),
    productRecommendations: ProviderCapabilitySchema.optional(),
  })
  .partial();

export interface AlgoliaProviderFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: AlgoliaConfiguration;
}

export interface AlgoliaProductSearchProviderFactoryArgs<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
> extends AlgoliaProviderFactoryArgs {
  factory: ProductSearchFactoryWithOutput<TFactory>;
}

export interface AlgoliaProductSearchCapabilityConfig<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
  TProvider extends ProductSearchProvider = ProductSearchProvider,
> {
  enabled: boolean;
  factory?: ProductSearchFactoryWithOutput<TFactory>;
  provider?: (args: AlgoliaProductSearchProviderFactoryArgs<TFactory>) => TProvider;
}

export interface AlgoliaAnalyticsCapabilityConfig<
  TProvider extends AnalyticsProvider = AnalyticsProvider,
> {
  enabled: boolean;
  provider?: (args: AlgoliaProviderFactoryArgs) => TProvider;
}

export interface AlgoliaProductRecommendationsCapabilityConfig<
  TProvider extends ProductRecommendationsProvider = ProductRecommendationsProvider,
> {
  enabled: boolean;
  provider?: (args: AlgoliaProviderFactoryArgs) => TProvider;
}

export type AlgoliaCapabilities<
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchProvider extends ProductSearchProvider = ProductSearchProvider,
  TAnalyticsProvider extends AnalyticsProvider = AnalyticsProvider,
  TProductRecommendationsProvider extends ProductRecommendationsProvider = ProductRecommendationsProvider,
> = {
  productSearch?: AlgoliaProductSearchCapabilityConfig<
    TProductSearchFactory,
    TProductSearchProvider
  >;
  analytics?: AlgoliaAnalyticsCapabilityConfig<TAnalyticsProvider>;
  productRecommendations?: AlgoliaProductRecommendationsCapabilityConfig<TProductRecommendationsProvider>;
};
