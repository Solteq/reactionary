import type {
  Cache,
  RequestContext,
  AnalyticsCapability,
  CartFactory,
  CartFactoryWithOutput,
  CartCapability,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryCapability,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutCapability,
  IdentityFactory,
  IdentityFactoryWithOutput,
  IdentityCapability,
  InventoryFactory,
  InventoryFactoryWithOutput,
  InventoryCapability,
  OrderFactory,
  OrderFactoryWithOutput,
  OrderCapability,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchCapability,
  PersonalizationProfileCapability,
  PersonalizationProfileFactory,
  PersonalizationProfileFactoryWithOutput,
  PriceFactory,
  PriceFactoryWithOutput,
  PriceCapability,
  ProductAssociationsCapability,
  ProductAssociationsFactory,
  ProductAssociationsFactoryWithOutput,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductCapability,
  ProductRecommendationsCapability,
  ProductRecommendationsFactory,
  ProductRecommendationsFactoryWithOutput,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileCapability,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { HclConfiguration } from './configuration.schema.js';
import type { HclClient } from '../core/client.js';
import * as z from 'zod';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

export const HclCapabilitiesSchema = CapabilitiesSchema.pick({
  cart: true,
  checkout: true,
  category: true,
  product: true,
  price: true,
  inventory: true,
  identity: true,
  productSearch: true,
  profile: true,
  order: true,
  orderSearch: true,
  analytics: true,
  productAssociations: true,
  productRecommendations: true,
  personalizationProfile: true,
})
  .extend({
    cart: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    product: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    identity: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    order: OverridableCapabilitySchema.optional(),
    orderSearch: OverridableCapabilitySchema.optional(),
    analytics: OverridableCapabilitySchema.optional(),
    productAssociations: OverridableCapabilitySchema.optional(),
    productRecommendations: OverridableCapabilitySchema.optional(),
    personalizationProfile: OverridableCapabilitySchema.optional(),
  })
  .partial();

export type HclCapabilities = z.infer<typeof HclCapabilitiesSchema>;

export interface HclCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: HclConfiguration;
  hclClient: HclClient;
}

export interface HclFactoryCapabilityArgs<TFactory>
  extends HclCapabilityFactoryArgs {
  factory: TFactory;
}

export interface HclCapabilityConfig<TFactory, TCapability> {
  enabled: boolean;
  factory?: TFactory;
  capability?: (args: HclFactoryCapabilityArgs<TFactory>) => TCapability;
}

export type HclCartCapabilityConfig = HclCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;

export type HclCategoryCapabilityConfig = HclCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;

export type HclCheckoutCapabilityConfig = HclCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutCapability
>;

export type HclInventoryCapabilityConfig = HclCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;

export type HclPriceCapabilityConfig = HclCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;

export type HclProductCapabilityConfig = HclCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductCapability
>;

export type HclProductSearchCapabilityConfig = HclCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;

export type HclIdentityCapabilityConfig = HclCapabilityConfig<
  IdentityFactoryWithOutput<IdentityFactory>,
  IdentityCapability
>;

export type HclProfileCapabilityConfig = HclCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;

export type HclOrderCapabilityConfig = HclCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderCapability
>;

export type HclOrderSearchCapabilityConfig = HclCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;

/** Analytics does not use a factory — the capability writes events directly. */
export type HclAnalyticsCapabilityConfig = HclCapabilityConfig<
  never,
  AnalyticsCapability
>;

export type HclProductAssociationsCapabilityConfig = HclCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsCapability
>;

/** Product recommendations uses a factory to parse espot activity data into recommendations. */
export type HclProductRecommendationsCapabilityConfig = HclCapabilityConfig<
  ProductRecommendationsFactoryWithOutput<ProductRecommendationsFactory>,
  ProductRecommendationsCapability
>;

export type HclPersonalizationProfileCapabilityConfig = HclCapabilityConfig<
  PersonalizationProfileFactoryWithOutput<PersonalizationProfileFactory>,
  PersonalizationProfileCapability
>;
