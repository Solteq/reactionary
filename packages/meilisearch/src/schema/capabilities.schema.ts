import type {
  Cache,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchCapability,
  ProductRecommendationsCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  RequestContext,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { MeilisearchConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const SearchCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

const DirectCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  capability: z.unknown().optional(),
});

export const MeilisearchCapabilitiesSchema = CapabilitiesSchema.pick({
  productSearch: true,
  productRecommendations: true,
  orderSearch: true,
})
  .extend({
    productSearch: SearchCapabilitySchema.optional(),
    orderSearch: SearchCapabilitySchema.optional(),
    productRecommendations: DirectCapabilitySchema.optional(),
  })
  .partial();

export interface MeilisearchCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MeilisearchConfiguration;
}

export interface MeilisearchProductSearchCapabilityFactoryArgs<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
> extends MeilisearchCapabilityFactoryArgs {
  factory: ProductSearchFactoryWithOutput<TFactory>;
}

export interface MeilisearchOrderSearchCapabilityFactoryArgs<
  TFactory extends OrderSearchFactory = OrderSearchFactory,
> extends MeilisearchCapabilityFactoryArgs {
  factory: OrderSearchFactoryWithOutput<TFactory>;
}

export interface MeilisearchProductSearchCapabilityConfig<
  TFactory extends ProductSearchFactory = ProductSearchFactory,
  TCapability extends ProductSearchCapability = ProductSearchCapability,
> {
  enabled: boolean;
  factory?: ProductSearchFactoryWithOutput<TFactory>;
  capability?: (args: MeilisearchProductSearchCapabilityFactoryArgs<TFactory>) => TCapability;
}

export interface MeilisearchOrderSearchCapabilityConfig<
  TFactory extends OrderSearchFactory = OrderSearchFactory,
  TCapability extends OrderSearchCapability = OrderSearchCapability,
> {
  enabled: boolean;
  factory?: OrderSearchFactoryWithOutput<TFactory>;
  capability?: (args: MeilisearchOrderSearchCapabilityFactoryArgs<TFactory>) => TCapability;
}

export interface MeilisearchProductRecommendationsCapabilityConfig<
  TCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
> {
  enabled: boolean;
  capability?: (args: MeilisearchCapabilityFactoryArgs) => TCapability;
}

export type MeilisearchCapabilities<
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchCapability extends ProductSearchCapability = ProductSearchCapability,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchCapability extends OrderSearchCapability = OrderSearchCapability,
  TProductRecommendationsCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
> = {
  productSearch?: MeilisearchProductSearchCapabilityConfig<
    TProductSearchFactory,
    TProductSearchCapability
  >;
  orderSearch?: MeilisearchOrderSearchCapabilityConfig<
    TOrderSearchFactory,
    TOrderSearchCapability
  >;
  productRecommendations?: MeilisearchProductRecommendationsCapabilityConfig<TProductRecommendationsCapability>;
};
