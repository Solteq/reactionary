import type {
  CartFactory,
  CartFactoryWithOutput,
  CartCapability,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryCapability,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutCapability,
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
  ProductRecommendationsCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileCapability,
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
  capability: z.unknown().optional(),
});

const DirectCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  capability: z.unknown().optional(),
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
    identity: DirectCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    productAssociations: OverridableCapabilitySchema.optional(),
    productRecommendations: DirectCapabilitySchema.optional(),
  })
  .partial();

export interface MedusaCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MedusaConfiguration;
  medusaApi: MedusaAPI;
}

export interface MedusaFactoryCapabilityArgs<TFactory>
  extends MedusaCapabilityFactoryArgs {
  factory: TFactory;
}

export interface MedusaCapabilityConfig<TFactory, TCapability> {
  enabled: boolean;
  factory?: TFactory;
  capability?: (args: MedusaFactoryCapabilityArgs<TFactory>) => TCapability;
}

export interface MedusaDirectCapabilityConfig<TCapability> {
  enabled: boolean;
  capability?: (args: MedusaCapabilityFactoryArgs) => TCapability;
}

export type MedusaProductCapabilityConfig = MedusaCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductCapability
>;

export type MedusaProductSearchCapabilityConfig = MedusaCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;

export type MedusaCartCapabilityConfig = MedusaCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;

export type MedusaCheckoutCapabilityConfig = MedusaCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutCapability
>;

export type MedusaCategoryCapabilityConfig = MedusaCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;

export type MedusaPriceCapabilityConfig = MedusaCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;

export type MedusaOrderCapabilityConfig = MedusaCapabilityConfig<
  OrderFactoryWithOutput<OrderFactory>,
  OrderCapability
>;

export type MedusaOrderSearchCapabilityConfig = MedusaCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;

export type MedusaInventoryCapabilityConfig = MedusaCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;

export type MedusaIdentityCapabilityConfig =
  MedusaDirectCapabilityConfig<IdentityCapability>;

export type MedusaProfileCapabilityConfig = MedusaCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;

export type MedusaProductAssociationsCapabilityConfig = MedusaCapabilityConfig<
  ProductAssociationsFactoryWithOutput<ProductAssociationsFactory>,
  ProductAssociationsCapability
>;

export type MedusaProductRecommendationsCapabilityConfig =
  MedusaDirectCapabilityConfig<ProductRecommendationsCapability>;

export type MedusaCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductCapability extends ProductCapability = ProductCapability,
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchCapability extends ProductSearchCapability = ProductSearchCapability,
  TCartFactory extends CartFactory = CartFactory,
  TCartCapability extends CartCapability = CartCapability,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutCapability extends CheckoutCapability = CheckoutCapability,
  TCategoryFactory extends CategoryFactory = CategoryFactory,
  TCategoryCapability extends CategoryCapability = CategoryCapability,
  TPriceFactory extends PriceFactory = PriceFactory,
  TPriceCapability extends PriceCapability = PriceCapability,
  TOrderFactory extends OrderFactory = OrderFactory,
  TOrderCapability extends OrderCapability = OrderCapability,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchCapability extends OrderSearchCapability = OrderSearchCapability,
  TInventoryFactory extends InventoryFactory = InventoryFactory,
  TInventoryCapability extends InventoryCapability = InventoryCapability,
  TIdentityCapability extends IdentityCapability = IdentityCapability,
  TProfileFactory extends ProfileFactory = ProfileFactory,
  TProfileCapability extends ProfileCapability = ProfileCapability,
  TProductAssociationsFactory extends ProductAssociationsFactory = ProductAssociationsFactory,
  TProductAssociationsCapability extends ProductAssociationsCapability = ProductAssociationsCapability,
  TProductRecommendationsCapability extends ProductRecommendationsCapability = ProductRecommendationsCapability,
> = {
  product?: MedusaCapabilityConfig<ProductFactoryWithOutput<TProductFactory>, TProductCapability>;
  productSearch?: MedusaCapabilityConfig<
    ProductSearchFactoryWithOutput<TProductSearchFactory>,
    TProductSearchCapability
  >;
  cart?: MedusaCapabilityConfig<CartFactoryWithOutput<TCartFactory>, TCartCapability>;
  checkout?: MedusaCapabilityConfig<
    CheckoutFactoryWithOutput<TCheckoutFactory>,
    TCheckoutCapability
  >;
  category?: MedusaCapabilityConfig<
    CategoryFactoryWithOutput<TCategoryFactory>,
    TCategoryCapability
  >;
  price?: MedusaCapabilityConfig<PriceFactoryWithOutput<TPriceFactory>, TPriceCapability>;
  order?: MedusaCapabilityConfig<OrderFactoryWithOutput<TOrderFactory>, TOrderCapability>;
  orderSearch?: MedusaCapabilityConfig<
    OrderSearchFactoryWithOutput<TOrderSearchFactory>,
    TOrderSearchCapability
  >;
  inventory?: MedusaCapabilityConfig<
    InventoryFactoryWithOutput<TInventoryFactory>,
    TInventoryCapability
  >;
  identity?: MedusaDirectCapabilityConfig<TIdentityCapability>;
  profile?: MedusaCapabilityConfig<ProfileFactoryWithOutput<TProfileFactory>, TProfileCapability>;
  productAssociations?: MedusaCapabilityConfig<
    ProductAssociationsFactoryWithOutput<TProductAssociationsFactory>,
    TProductAssociationsCapability
  >;
  productRecommendations?: MedusaDirectCapabilityConfig<TProductRecommendationsCapability>;
};

export type ParsedMedusaCapabilities = z.infer<typeof MedusaCapabilitiesSchema>;
