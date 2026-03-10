import type {
  Cache,
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
  PriceFactory,
  PriceFactoryWithOutput,
  PriceCapability,
  ProductAssociationsFactory,
  ProductAssociationsFactoryWithOutput,
  ProductAssociationsCapability,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductCapability,
  ProductReviewsFactory,
  ProductReviewsFactoryWithOutput,
  ProductReviewsCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileCapability,
  RequestContext,
  StoreFactory,
  StoreFactoryWithOutput,
  StoreCapability,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { FakeConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

export const FakeCapabilitiesSchema = CapabilitiesSchema.pick({
  product: true,
  productSearch: true,
  identity: true,
  category: true,
  cart: true,
  inventory: true,
  store: true,
  price: true,
  checkout: true,
  order: true,
  orderSearch: true,
  profile: true,
  productReviews: true,
  productAssociations: true,
})
  .extend({
    product: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    identity: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    cart: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    store: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
    order: OverridableCapabilitySchema.optional(),
    orderSearch: OverridableCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    productReviews: OverridableCapabilitySchema.optional(),
    productAssociations: OverridableCapabilitySchema.optional(),
  })
  .partial();

export interface FakeCapabilityFactoryArgs<TFactory> {
  cache: Cache;
  context: RequestContext;
  config: FakeConfiguration;
  factory: TFactory;
}

export interface FakeCapabilityConfig<TFactory, TCapability> {
  enabled: boolean;
  factory?: TFactory;
  capability?: (args: FakeCapabilityFactoryArgs<TFactory>) => TCapability;
}

export type FakeProductCapabilityConfig = FakeCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductCapability
>;
export type FakeProductSearchCapabilityConfig = FakeCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;
export type FakeIdentityCapabilityConfig = FakeCapabilityConfig<
  IdentityFactoryWithOutput<IdentityFactory>,
  IdentityCapability
>;
export type FakeCategoryCapabilityConfig = FakeCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;
export type FakeCartCapabilityConfig = FakeCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;
export type FakeInventoryCapabilityConfig = FakeCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;
export type FakeStoreCapabilityConfig = FakeCapabilityConfig<
  StoreFactoryWithOutput<StoreFactory>,
  StoreCapability
>;
export type FakePriceCapabilityConfig = FakeCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;
export type FakeCheckoutCapabilityConfig = FakeCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutCapability
>;
export type FakeOrderCapabilityConfig = FakeCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderCapability
>;
export type FakeOrderSearchCapabilityConfig = FakeCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;
export type FakeProfileCapabilityConfig = FakeCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;
export type FakeProductReviewsCapabilityConfig = FakeCapabilityConfig<
  ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
  ProductReviewsCapability
>;
export type FakeProductAssociationsCapabilityConfig = FakeCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsCapability
>;

export type FakeCapabilities = {
  product?: FakeProductCapabilityConfig;
  productSearch?: FakeProductSearchCapabilityConfig;
  identity?: FakeIdentityCapabilityConfig;
  category?: FakeCategoryCapabilityConfig;
  cart?: FakeCartCapabilityConfig;
  inventory?: FakeInventoryCapabilityConfig;
  store?: FakeStoreCapabilityConfig;
  price?: FakePriceCapabilityConfig;
  checkout?: FakeCheckoutCapabilityConfig;
  order?: FakeOrderCapabilityConfig;
  orderSearch?: FakeOrderSearchCapabilityConfig;
  profile?: FakeProfileCapabilityConfig;
  productReviews?: FakeProductReviewsCapabilityConfig;
  productAssociations?: FakeProductAssociationsCapabilityConfig;
};

export type ParsedFakeCapabilities = z.infer<typeof FakeCapabilitiesSchema>;
