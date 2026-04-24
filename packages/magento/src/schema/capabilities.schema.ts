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
})
  .extend({
    product: OverridableCapabilitySchema.optional(),
    productSearch: OverridableCapabilitySchema.optional(),
    cart: OverridableCapabilitySchema.optional(),
    category: OverridableCapabilitySchema.optional(),
    price: OverridableCapabilitySchema.optional(),
    inventory: OverridableCapabilitySchema.optional(),
    identity: DirectCapabilitySchema.optional(),
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
> = {
  product?: MagentoCapabilityConfig<ProductFactoryWithOutput<TProductFactory>, TProductCapability>;
  productSearch?: MagentoCapabilityConfig<ProductSearchFactoryWithOutput<TProductSearchFactory>, TProductSearchCapability>;
  cart?: MagentoCapabilityConfig<CartFactoryWithOutput<TCartFactory>, TCartCapability>;
  category?: MagentoCapabilityConfig<CategoryFactoryWithOutput<TCategoryFactory>, TCategoryCapability>;
  price?: MagentoCapabilityConfig<PriceFactoryWithOutput<TPriceFactory>, TPriceCapability>;
  inventory?: MagentoCapabilityConfig<InventoryFactoryWithOutput<TInventoryFactory>, TInventoryCapability>;
  identity?: MagentoDirectCapabilityConfig<TIdentityCapability>;
};
