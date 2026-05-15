import type {
  Cache,
  RequestContext,
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
  PriceFactory,
  PriceFactoryWithOutput,
  PriceCapability,
  ProductFactory,
  ProductFactoryWithOutput,
  ProductCapability,
  ProductSearchFactory,
  ProductSearchFactoryWithOutput,
  ProductSearchCapability,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import type { HclConfiguration } from './configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclTransactionClient } from '../core/transaction-client.js';
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
  })
  .partial();

export type HclCapabilities = z.infer<typeof HclCapabilitiesSchema>;

export interface HclCapabilityFactoryArgs {
  cache: Cache;
  context: RequestContext;
  config: HclConfiguration;
  hclClient: HclClient;
  hclTransactionClient: HclTransactionClient;
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
