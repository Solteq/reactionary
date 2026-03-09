import type {
  CartFactory,
  CartFactoryWithOutput,
  CartProvider,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryProvider,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutProvider,
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
  ProductRecommendationsProvider,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchProvider,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileProvider,
  RequestContext,
  Cache,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { MedusaConfiguration } from './configuration.schema.js';
import type { MedusaAPI } from '../core/client.js';
import * as z from 'zod';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  provider: z.unknown().optional(),
});

const ProviderCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  provider: z.unknown().optional(),
});

export const MedusaCapabilitiesSchema = CapabilitiesSchema.pick({
  productSearch: true,
  productRecommendations: true,
  cart: true,
  checkout: true,
  category: true,
  product: true,
  price: true,
  order: true,
  orderSearch: true,
  inventory: true,
  identity: true,
  profile: true,
  productAssociations: true,
})
  .extend({
    product: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    cart: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    order: OverridableCapabilitySchema.optional(),
    orderSearch: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    identity: ProviderCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    productAssociations: OverridableCapabilitySchema.optional(),
    productRecommendations: ProviderCapabilitySchema.optional(),
  })
  .partial();

export interface MedusaProviderFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MedusaConfiguration;
  medusaApi: MedusaAPI;
}

export interface MedusaFactoryProviderArgs<TFactory>
  extends MedusaProviderFactoryArgs {
  factory: TFactory;
}

export interface MedusaCapabilityConfig<TFactory, TProvider> {
  enabled: boolean;
  factory?: TFactory;
  provider?: (args: MedusaFactoryProviderArgs<TFactory>) => TProvider;
}

export interface MedusaProviderOnlyCapabilityConfig<TProvider> {
  enabled: boolean;
  provider?: (args: MedusaProviderFactoryArgs) => TProvider;
}

export type MedusaProductCapabilityConfig = MedusaCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductProvider
>;

export type MedusaProductSearchCapabilityConfig = MedusaCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchProvider
>;

export type MedusaCartCapabilityConfig = MedusaCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartProvider
>;

export type MedusaCheckoutCapabilityConfig = MedusaCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutProvider
>;

export type MedusaCategoryCapabilityConfig = MedusaCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryProvider
>;

export type MedusaPriceCapabilityConfig = MedusaCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceProvider
>;

export type MedusaOrderCapabilityConfig = MedusaCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderProvider
>;

export type MedusaOrderSearchCapabilityConfig = MedusaCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchProvider
>;

export type MedusaInventoryCapabilityConfig = MedusaCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryProvider
>;

export type MedusaIdentityCapabilityConfig =
  MedusaProviderOnlyCapabilityConfig<IdentityProvider>;

export type MedusaProfileCapabilityConfig = MedusaCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileProvider
>;

export type MedusaProductAssociationsCapabilityConfig = MedusaCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsProvider
>;

export type MedusaProductRecommendationsCapabilityConfig =
  MedusaProviderOnlyCapabilityConfig<ProductRecommendationsProvider>;

export type MedusaCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductProvider extends ProductProvider = ProductProvider,
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchProvider extends ProductSearchProvider = ProductSearchProvider,
  TCartFactory extends CartFactory = CartFactory,
  TCartProvider extends CartProvider = CartProvider,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutProvider extends CheckoutProvider = CheckoutProvider,
  TCategoryFactory extends CategoryFactory = CategoryFactory,
  TCategoryProvider extends CategoryProvider = CategoryProvider,
  TPriceFactory extends PriceFactory = PriceFactory,
  TPriceProvider extends PriceProvider = PriceProvider,
  TOrderFactory extends OrderFactory = OrderFactory,
  TOrderProvider extends OrderProvider = OrderProvider,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchProvider extends OrderSearchProvider = OrderSearchProvider,
  TInventoryFactory extends InventoryFactory = InventoryFactory,
  TInventoryProvider extends InventoryProvider = InventoryProvider,
  TIdentityProvider extends IdentityProvider = IdentityProvider,
  TProfileFactory extends ProfileFactory = ProfileFactory,
  TProfileProvider extends ProfileProvider = ProfileProvider,
  TProductAssociationsFactory extends ProductAssociationsFactory = ProductAssociationsFactory,
  TProductAssociationsProvider extends ProductAssociationsProvider = ProductAssociationsProvider,
  TProductRecommendationsProvider extends ProductRecommendationsProvider = ProductRecommendationsProvider,
> = {
  product?: MedusaCapabilityConfig<ProductFactoryWithOutput<TProductFactory>, TProductProvider>;
  productSearch?: MedusaCapabilityConfig<
    ProductSearchFactoryWithOutput<TProductSearchFactory>,
    TProductSearchProvider
  >;
  cart?: MedusaCapabilityConfig<CartFactoryWithOutput<TCartFactory>, TCartProvider>;
  checkout?: MedusaCapabilityConfig<
    CheckoutFactoryWithOutput<TCheckoutFactory>,
    TCheckoutProvider
  >;
  category?: MedusaCapabilityConfig<
    CategoryFactoryWithOutput<TCategoryFactory>,
    TCategoryProvider
  >;
  price?: MedusaCapabilityConfig<PriceFactoryWithOutput<TPriceFactory>, TPriceProvider>;
  order?: MedusaCapabilityConfig<OrderFactoryWithOutput<TOrderFactory>, TOrderProvider>;
  orderSearch?: MedusaCapabilityConfig<
    OrderSearchFactoryWithOutput<TOrderSearchFactory>,
    TOrderSearchProvider
  >;
  inventory?: MedusaCapabilityConfig<
    InventoryFactoryWithOutput<TInventoryFactory>,
    TInventoryProvider
  >;
  identity?: MedusaProviderOnlyCapabilityConfig<TIdentityProvider>;
  profile?: MedusaCapabilityConfig<ProfileFactoryWithOutput<TProfileFactory>, TProfileProvider>;
  productAssociations?: MedusaCapabilityConfig<
    ProductAssociationsFactoryWithOutput<TProductAssociationsFactory>,
    TProductAssociationsProvider
  >;
  productRecommendations?: MedusaProviderOnlyCapabilityConfig<TProductRecommendationsProvider>;
};

export type ParsedMedusaCapabilities = z.infer<typeof MedusaCapabilitiesSchema>;
