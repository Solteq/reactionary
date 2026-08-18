import type {
  CartFactory,
  CartFactoryWithOutput,
  CartCapability,
  CategoryFactory,
  CategoryFactoryWithOutput,
  CategoryCapability,
  IdentityCapability,
  InventoryFactory,
  InventoryFactoryWithOutput,
  InventoryCapability,
  PriceFactory,
  PriceFactoryWithOutput,
  PriceCapability,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
  ProfileFactory,
  ProfileFactoryWithOutput,
  ProfileCapability,
  OrderSearchFactory,
  OrderSearchFactoryWithOutput,
  OrderSearchCapability,
  CheckoutFactory,
  CheckoutFactoryWithOutput,
  CheckoutCapability,
  RequestContext,
  Cache,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { MagentoConfiguration } from './configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
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

export const MagentoCapabilitiesSchema = CapabilitiesSchema.pick({
  product: true,
  productSearch: true,
  category: true,
  inventory: true,
  price: true,
  identity: true,
  cart: true,
  profile: true,
  orderSearch: true,
  checkout: true,
})
  .extend({
    product: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    cart: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    identity: DirectCapabilitySchema.optional(),
    profile: OverridableCapabilitySchema.optional(),
    orderSearch: OverridableCapabilitySchema.optional(),
    checkout: OverridableCapabilitySchema.optional(),
  })
  .partial();

export interface MagentoCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: MagentoConfiguration;
  magentoApi: MagentoClient;
}

export interface MagentoFactoryCapabilityArgs<TFactory>
  extends MagentoCapabilityFactoryArgs {
  factory: TFactory;
}

export interface MagentoCapabilityConfig<TFactory, TCapability> {
  enabled: boolean;
  factory?: TFactory;
  capability?: (args: MagentoFactoryCapabilityArgs<TFactory>) => TCapability;
}

export interface MagentoDirectCapabilityConfig<TCapability> {
  enabled: boolean;
  capability?: (args: MagentoCapabilityFactoryArgs) => TCapability;
}

export type MagentoProductCapabilityConfig = MagentoCapabilityConfig<
  ProductFactoryWithOutput<ProductFactory>,
  ProductCapability
>;

export type MagentoProductSearchCapabilityConfig = MagentoCapabilityConfig<
  ProductSearchFactoryWithOutput<ProductSearchFactory>,
  ProductSearchCapability
>;

export type MagentoCartCapabilityConfig = MagentoCapabilityConfig<
  CartFactoryWithOutput<CartFactory>,
  CartCapability
>;

export type MagentoCategoryCapabilityConfig = MagentoCapabilityConfig<
  CategoryFactoryWithOutput<CategoryFactory>,
  CategoryCapability
>;

export type MagentoPriceCapabilityConfig = MagentoCapabilityConfig<
  PriceFactoryWithOutput<PriceFactory>,
  PriceCapability
>;

export type MagentoInventoryCapabilityConfig = MagentoCapabilityConfig<
  InventoryFactoryWithOutput<InventoryFactory>,
  InventoryCapability
>;

export type MagentoIdentityCapabilityConfig =
  MagentoDirectCapabilityConfig<IdentityCapability>;

export type MagentoProfileCapabilityConfig = MagentoCapabilityConfig<
  ProfileFactoryWithOutput<ProfileFactory>,
  ProfileCapability
>;

export type MagentoOrderSearchCapabilityConfig = MagentoCapabilityConfig<
  OrderSearchFactoryWithOutput<OrderSearchFactory>,
  OrderSearchCapability
>;

export type MagentoCheckoutCapabilityConfig = MagentoCapabilityConfig<
  CheckoutFactoryWithOutput<CheckoutFactory>,
  CheckoutCapability
>;

export type MagentoCapabilities<
  TProductFactory extends ProductFactory = ProductFactory,
  TProductCapability extends ProductCapability = ProductCapability,
  TProductSearchFactory extends ProductSearchFactory = ProductSearchFactory,
  TProductSearchCapability extends ProductSearchCapability = ProductSearchCapability,
  TCartFactory extends CartFactory = CartFactory,
  TCartCapability extends CartCapability = CartCapability,
  TCategoryFactory extends CategoryFactory = CategoryFactory,
  TCategoryCapability extends CategoryCapability = CategoryCapability,
  TPriceFactory extends PriceFactory = PriceFactory,
  TPriceCapability extends PriceCapability = PriceCapability,
  TInventoryFactory extends InventoryFactory = InventoryFactory,
  TInventoryCapability extends InventoryCapability = InventoryCapability,
  TIdentityCapability extends IdentityCapability = IdentityCapability,
  TProfileFactory extends ProfileFactory = ProfileFactory,
  TProfileCapability extends ProfileCapability = ProfileCapability,
  TOrderSearchFactory extends OrderSearchFactory = OrderSearchFactory,
  TOrderSearchCapability extends OrderSearchCapability = OrderSearchCapability,
  TCheckoutFactory extends CheckoutFactory = CheckoutFactory,
  TCheckoutCapability extends CheckoutCapability = CheckoutCapability,
> = {
  product?: MagentoCapabilityConfig<ProductFactoryWithOutput<TProductFactory>, TProductCapability>;
  productSearch?: MagentoCapabilityConfig<ProductSearchFactoryWithOutput<TProductSearchFactory>, TProductSearchCapability>;
  cart?: MagentoCapabilityConfig<CartFactoryWithOutput<TCartFactory>, TCartCapability>;
  category?: MagentoCapabilityConfig<CategoryFactoryWithOutput<TCategoryFactory>, TCategoryCapability>;
  price?: MagentoCapabilityConfig<PriceFactoryWithOutput<TPriceFactory>, TPriceCapability>;
  inventory?: MagentoCapabilityConfig<InventoryFactoryWithOutput<TInventoryFactory>, TInventoryCapability>;
  identity?: MagentoDirectCapabilityConfig<TIdentityCapability>;
  profile?: MagentoCapabilityConfig<ProfileFactoryWithOutput<TProfileFactory>, TProfileCapability>;
  orderSearch?: MagentoCapabilityConfig<OrderSearchFactoryWithOutput<TOrderSearchFactory>, TOrderSearchCapability>;
  checkout?: MagentoCapabilityConfig<CheckoutFactoryWithOutput<TCheckoutFactory>, TCheckoutCapability>;
};
