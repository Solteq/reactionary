import type {
  Cache,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchProvider,
  ProductRecommendationsProvider,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchProvider,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { MeilisearchConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const SearchCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  provider: z.unknown().optional(),
});

const ProviderCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  provider: z.unknown().optional(),
});

export const MeilisearchCapabilitiesSchema = CapabilitiesSchema.pick({
  productSearch: true,
  productRecommendations: true,
  orderSearch: true,
})
  .extend({
    productSearch: SearchCapabilitySchema.optional(),
    orderSearch: SearchCapabilitySchema.optional(),
    productRecommendations: ProviderCapabilitySchema.optional(),
  })
  .partial();

export interface MeilisearchProviderFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MeilisearchConfiguration;
}

export interface MeilisearchSearchProviderFactoryArgs<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
> extends MeilisearchProviderFactoryArgs {
  factory: ProductSearchFactoryWithOutput<TFactory>;
}

export interface MeilisearchOrderSearchProviderFactoryArgs<
  TFactory extends OrderSearchFactory = OrderSearchFactory,
> extends MeilisearchProviderFactoryArgs {
  factory: OrderSearchFactoryWithOutput<TFactory>;
}

export interface MeilisearchProductSearchCapabilityConfig<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
  TProvider extends ProductSearchProvider = ProductSearchProvider,
> {
  enabled: boolean;
  factory?: ProductSearchFactoryWithOutput<TFactory>;
  provider?: (args: MeilisearchSearchProviderFactoryArgs<TFactory>) => TProvider;
}

export interface MeilisearchOrderSearchCapabilityConfig<
  TFactory extends OrderSearchFactory = OrderSearchFactory,
  TProvider extends OrderSearchProvider = OrderSearchProvider,
> {
  enabled: boolean;
  factory?: OrderSearchFactoryWithOutput<TFactory>;
  provider?: (args: MeilisearchOrderSearchProviderFactoryArgs<TFactory>) => TProvider;
}

export interface MeilisearchProductRecommendationsCapabilityConfig<
  TProvider extends ProductRecommendationsProvider = ProductRecommendationsProvider,
> {
  enabled: boolean;
  provider?: (args: MeilisearchProviderFactoryArgs) => TProvider;
}

export type MeilisearchCapabilities<
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchProvider extends ProductSearchProvider = ProductSearchProvider,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchProvider extends OrderSearchProvider = OrderSearchProvider,
  TProductRecommendationsProvider extends ProductRecommendationsProvider = ProductRecommendationsProvider,
> = {
  productSearch?: MeilisearchProductSearchCapabilityConfig<
    TProductSearchFactory,
    TProductSearchProvider
  >;
  orderSearch?: MeilisearchOrderSearchCapabilityConfig<
    TOrderSearchFactory,
    TOrderSearchProvider
  >;
  productRecommendations?: MeilisearchProductRecommendationsCapabilityConfig<TProductRecommendationsProvider>;
};
