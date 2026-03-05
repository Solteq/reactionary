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
  ProductListFactory,
  ProductListFactoryWithOutput,
  ProductListProvider,
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
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const EnabledCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
});

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  provider: z.unknown().optional(),
});

export const CommercetoolsCapabilitiesSchema = CapabilitiesSchema.pick({
  product: true,
  productSearch: true,
  productAssociations: true,
  productReviews: true,
  productList: true,
  identity: true,
  cart: true,
  checkout: true,
  order: true,
  orderSearch: true,
  inventory: true,
  price: true,
  category: true,
  store: true,
  profile: true,
})
  .extend({
    productSearch: EnabledCapabilitySchema.optional(),
    productAssociations: EnabledCapabilitySchema.optional(),
    productReviews: EnabledCapabilitySchema.optional(),
    productList: EnabledCapabilitySchema.optional(),
    identity: EnabledCapabilitySchema.optional(),
    cart: EnabledCapabilitySchema.optional(),
    order: EnabledCapabilitySchema.optional(),
    orderSearch: EnabledCapabilitySchema.optional(),
    inventory: EnabledCapabilitySchema.optional(),
    price: EnabledCapabilitySchema.optional(),
    category: EnabledCapabilitySchema.optional(),
    store: EnabledCapabilitySchema.optional(),
    profile: EnabledCapabilitySchema.optional(),
    product: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
  })
  .partial();

export interface CommercetoolsCapabilityProviderFactoryArgs<TFactory> {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: TFactory;
}

export interface CommercetoolsCapabilityConfig<TFactory, TProvider> {
  factory?: TFactory;
  provider?: (args: CommercetoolsCapabilityProviderFactoryArgs<TFactory>) => TProvider;
}

type EnabledCapabilityConfig<TFactory, TProvider> = {
  enabled: boolean;
} & CommercetoolsCapabilityConfig<TFactory, TProvider>;

export type CommercetoolsProductCapabilityConfig<
  TFactory extends ProductFactory = ProductFactory,
  TProvider extends ProductProvider = ProductProvider,
> = CommercetoolsCapabilityConfig<ProductFactoryWithOutput<TFactory>, TProvider>;

export type CommercetoolsCheckoutCapabilityConfig<
  TFactory extends CheckoutFactory = CheckoutFactory,
  TProvider extends CheckoutProvider = CheckoutProvider,
> = CommercetoolsCapabilityConfig<CheckoutFactoryWithOutput<TFactory>, TProvider>;

export type CommercetoolsProductSearchCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchProvider
>;
export type CommercetoolsProductAssociationsCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsProvider
>;
export type CommercetoolsProductReviewsCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
  ProductReviewsProvider
>;
export type CommercetoolsProductListCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductListFactoryWithOutput<ProductListFactory>,
  ProductListProvider
>;
export type CommercetoolsIdentityCapabilityConfig = CommercetoolsCapabilityConfig<
  IdentityFactoryWithOutput<IdentityFactory>,
  IdentityProvider
>;
export type CommercetoolsCartCapabilityConfig = CommercetoolsCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartProvider
>;
export type CommercetoolsInventoryCapabilityConfig = CommercetoolsCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryProvider
>;
export type CommercetoolsPriceCapabilityConfig = CommercetoolsCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceProvider
>;
export type CommercetoolsCategoryCapabilityConfig = CommercetoolsCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryProvider
>;
export type CommercetoolsStoreCapabilityConfig = CommercetoolsCapabilityConfig<
  StoreFactoryWithOutput<StoreFactory>,
  StoreProvider
>;
export type CommercetoolsProfileCapabilityConfig = CommercetoolsCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileProvider
>;
export type CommercetoolsOrderCapabilityConfig = CommercetoolsCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderProvider
>;
export type CommercetoolsOrderSearchCapabilityConfig = CommercetoolsCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchProvider
>;

export type CommercetoolsCapabilityConfigMap<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductProvider extends ProductProvider = ProductProvider,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutProvider extends CheckoutProvider = CheckoutProvider,
> = {
  product: EnabledCapabilityConfig<
    ProductFactoryWithOutput<TProductFactory>,
    TProductProvider
  >;
  checkout: EnabledCapabilityConfig<
    CheckoutFactoryWithOutput<TCheckoutFactory>,
    TCheckoutProvider
  >;
  productSearch: EnabledCapabilityConfig<
    ProductSearchFactoryWithOutput<ProductSearchFactory>,
    ProductSearchProvider
  >;
  productAssociations: EnabledCapabilityConfig<
    ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
    ProductAssociationsProvider
  >;
  productReviews: EnabledCapabilityConfig<
    ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
    ProductReviewsProvider
  >;
  productList: EnabledCapabilityConfig<
    ProductListFactoryWithOutput<ProductListFactory>,
    ProductListProvider
  >;
  identity: EnabledCapabilityConfig<
    IdentityFactoryWithOutput<IdentityFactory>,
    IdentityProvider
  >;
  cart: EnabledCapabilityConfig<CartFactoryWithOutput<CartFactory>, CartProvider>;
  inventory: EnabledCapabilityConfig<
    InventoryFactoryWithOutput<InventoryFactory>,
    InventoryProvider
  >;
  price: EnabledCapabilityConfig<PriceFactoryWithOutput<PriceFactory>, PriceProvider>;
  category: EnabledCapabilityConfig<
    CategoryFactoryWithOutput<CategoryFactory>,
    CategoryProvider
  >;
  store: EnabledCapabilityConfig<StoreFactoryWithOutput<StoreFactory>, StoreProvider>;
  profile: EnabledCapabilityConfig<
    ProfileFactoryWithOutput<ProfileFactory>,
    ProfileProvider
  >;
  order: EnabledCapabilityConfig<OrderFactoryWithOutput<OrderFactory>, OrderProvider>;
  orderSearch: EnabledCapabilityConfig<
    OrderSearchFactoryWithOutput<OrderSearchFactory>,
    OrderSearchProvider
  >;
};

type CommercetoolsCapabilitiesBase = z.infer<typeof CommercetoolsCapabilitiesSchema>;

export type CommercetoolsCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductProvider extends ProductProvider = ProductProvider,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutProvider extends CheckoutProvider = CheckoutProvider,
> = Omit<
  CommercetoolsCapabilitiesBase,
  keyof CommercetoolsCapabilityConfigMap<
    TProductFactory,
    TProductProvider,
    TCheckoutFactory,
    TCheckoutProvider
  >
> &
  Partial<
    CommercetoolsCapabilityConfigMap<
      TProductFactory,
      TProductProvider,
      TCheckoutFactory,
      TCheckoutProvider
    >
  >;
