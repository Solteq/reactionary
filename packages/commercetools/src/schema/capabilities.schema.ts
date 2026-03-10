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
  ProductListFactory,
  ProductListFactoryWithOutput,
  ProductListCapability,
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
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsConfiguration } from './configuration.schema.js';
import * as z from 'zod';

const EnabledCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
});

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
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

export interface CommercetoolsCapabilityFactoryArgs<TFactory> {
  cache: Cache;
  context: RequestContext;
  config: CommercetoolsConfiguration;
  commercetoolsApi: CommercetoolsAPI;
  factory: TFactory;
}

export interface CommercetoolsCapabilityConfig<TFactory, TCapability> {
  factory?: TFactory;
  capability?: (args: CommercetoolsCapabilityFactoryArgs<TFactory>) => TCapability;
}

type EnabledCapabilityConfig<TFactory, TCapability> = {
  enabled: boolean;
} & CommercetoolsCapabilityConfig<TFactory, TCapability>;

export type CommercetoolsProductCapabilityConfig<
  TFactory extends ProductFactory = ProductFactory,
  TCapability extends ProductCapability = ProductCapability,
> = CommercetoolsCapabilityConfig<ProductFactoryWithOutput<TFactory>, TCapability>;

export type CommercetoolsCheckoutCapabilityConfig<
  TFactory extends CheckoutFactory = CheckoutFactory,
  TCapability extends CheckoutCapability = CheckoutCapability,
> = CommercetoolsCapabilityConfig<CheckoutFactoryWithOutput<TFactory>, TCapability>;

export type CommercetoolsProductSearchCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;
export type CommercetoolsProductAssociationsCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsCapability
>;
export type CommercetoolsProductReviewsCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
  ProductReviewsCapability
>;
export type CommercetoolsProductListCapabilityConfig = CommercetoolsCapabilityConfig<
  ProductListFactoryWithOutput<ProductListFactory>,
  ProductListCapability
>;
export type CommercetoolsIdentityCapabilityConfig = CommercetoolsCapabilityConfig<
  IdentityFactoryWithOutput<IdentityFactory>,
  IdentityCapability
>;
export type CommercetoolsCartCapabilityConfig = CommercetoolsCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;
export type CommercetoolsInventoryCapabilityConfig = CommercetoolsCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;
export type CommercetoolsPriceCapabilityConfig = CommercetoolsCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;
export type CommercetoolsCategoryCapabilityConfig = CommercetoolsCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;
export type CommercetoolsStoreCapabilityConfig = CommercetoolsCapabilityConfig<
  StoreFactoryWithOutput<StoreFactory>,
  StoreCapability
>;
export type CommercetoolsProfileCapabilityConfig = CommercetoolsCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;
export type CommercetoolsOrderCapabilityConfig = CommercetoolsCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderCapability
>;
export type CommercetoolsOrderSearchCapabilityConfig = CommercetoolsCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;

export type CommercetoolsCapabilityConfigMap<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductCapability extends ProductCapability = ProductCapability,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutCapability extends CheckoutCapability = CheckoutCapability,
> = {
  product: EnabledCapabilityConfig<
    ProductFactoryWithOutput<TProductFactory>,
    TProductCapability
  >;
  checkout: EnabledCapabilityConfig<
    CheckoutFactoryWithOutput<TCheckoutFactory>,
    TCheckoutCapability
  >;
  productSearch: EnabledCapabilityConfig<
    ProductSearchFactoryWithOutput<ProductSearchFactory>,
    ProductSearchCapability
  >;
  productAssociations: EnabledCapabilityConfig<
    ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
    ProductAssociationsCapability
  >;
  productReviews: EnabledCapabilityConfig<
    ProductReviewsFactoryWithOutput<ProductReviewsFactory>,
    ProductReviewsCapability
  >;
  productList: EnabledCapabilityConfig<
    ProductListFactoryWithOutput<ProductListFactory>,
    ProductListCapability
  >;
  identity: EnabledCapabilityConfig<
    IdentityFactoryWithOutput<IdentityFactory>,
    IdentityCapability
  >;
  cart: EnabledCapabilityConfig<CartFactoryWithOutput<CartFactory>, CartCapability>;
  inventory: EnabledCapabilityConfig<
    InventoryFactoryWithOutput<InventoryFactory>,
    InventoryCapability
  >;
  price: EnabledCapabilityConfig<PriceFactoryWithOutput<PriceFactory>, PriceCapability>;
  category: EnabledCapabilityConfig<
    CategoryFactoryWithOutput<CategoryFactory>,
    CategoryCapability
  >;
  store: EnabledCapabilityConfig<StoreFactoryWithOutput<StoreFactory>, StoreCapability>;
  profile: EnabledCapabilityConfig<
    ProfileFactoryWithOutput<ProfileFactory>,
    ProfileCapability
  >;
  order: EnabledCapabilityConfig<OrderFactoryWithOutput<OrderFactory>, OrderCapability>;
  orderSearch: EnabledCapabilityConfig<
    OrderSearchFactoryWithOutput<OrderSearchFactory>,
    OrderSearchCapability
  >;
};

type CommercetoolsCapabilitiesBase = z.infer<typeof CommercetoolsCapabilitiesSchema>;

export type CommercetoolsCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductCapability extends ProductCapability = ProductCapability,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutCapability extends CheckoutCapability = CheckoutCapability,
> = Omit<
  CommercetoolsCapabilitiesBase,
  keyof CommercetoolsCapabilityConfigMap<
    TProductFactory,
    TProductCapability,
    TCheckoutFactory,
    TCheckoutCapability
  >
> &
  Partial<
    CommercetoolsCapabilityConfigMap<
      TProductFactory,
      TProductCapability,
      TCheckoutFactory,
      TCheckoutCapability
    >
  >;
