import type {
  Cache,
  CartFactory,
  CartFactoryWithOutput,
  CartProvider,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryProvider,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutProvider,
  IdentityFactory,
  IdentityFactoryWithOutput,
  IdentityProvider,
  InventoryFactory,
  InventoryFactoryWithOutput,
  InventoryProvider,
  OrderFactory,
  OrderFactoryWithOutput,
  OrderProvider,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchProvider,
  PriceFactory,
  PriceFactoryWithOutput,
  PriceProvider,
  ProductAssociationsFactory,
  ProductAssociationsFactoryWithOutput,
  ProductAssociationsProvider,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductProvider,
  ProductReviewsFactory,
  ProductReviewsFactoryWithOutput,
  ProductReviewsProvider,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchProvider,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileProvider,
  RequestContext,
  StoreFactory,
  StoreFactoryWithOutput,
  StoreProvider,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { FakeConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  provider: z.unknown().optional(),
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

export interface FakeCapabilityProviderFactoryArgs<TFactory> {
  cache: Cache;
  context: RequestContext;
  config: FakeConfiguration;
  factory: TFactory;
}

export interface FakeCapabilityConfig<TFactory, TProvider> {
  enabled: boolean;
  factory?: TFactory;
  provider?: (args: FakeCapabilityProviderFactoryArgs<TFactory>) => TProvider;
}

export type FakeProductCapabilityConfig = FakeCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductProvider
>;
export type FakeProductSearchCapabilityConfig = FakeCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchProvider
>;
export type FakeIdentityCapabilityConfig = FakeCapabilityConfig<
  IdentityFactoryWithOutput<IdentityFactory>,
  IdentityProvider
>;
export type FakeCategoryCapabilityConfig = FakeCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryProvider
>;
export type FakeCartCapabilityConfig = FakeCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartProvider
>;
export type FakeInventoryCapabilityConfig = FakeCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryProvider
>;
export type FakeStoreCapabilityConfig = FakeCapabilityConfig<
  StoreFactoryWithOutput<StoreFactory>,
  StoreProvider
>;
export type FakePriceCapabilityConfig = FakeCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceProvider
>;
export type FakeCheckoutCapabilityConfig = FakeCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutProvider
>;
export type FakeOrderCapabilityConfig = FakeCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderProvider
>;
export type FakeOrderSearchCapabilityConfig = FakeCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchProvider
>;
export type FakeProfileCapabilityConfig = FakeCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileProvider
>;
export type FakeProductReviewsCapabilityConfig = FakeCapabilityConfig<
  ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
  ProductReviewsProvider
>;
export type FakeProductAssociationsCapabilityConfig = FakeCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsProvider
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
