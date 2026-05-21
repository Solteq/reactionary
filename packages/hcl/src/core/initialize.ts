import type { Cache, RequestContext } from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
  IdentitySchema,
  OrderSchema,
  OrderSearchResultSchema,
  ProductSchema,
  ProfileSchema,
} from '@reactionary/core';
import { HclCategorySchema } from '../schema/category.schema.js';
import {
  HclCapabilitiesSchema,
  type HclCapabilities,
  type HclCartCapabilityConfig,
  type HclCheckoutCapabilityConfig,
  type HclProductCapabilityConfig,
  type HclCategoryCapabilityConfig,
  type HclProductSearchCapabilityConfig,
  type HclPriceCapabilityConfig,
  type HclInventoryCapabilityConfig,
  type HclIdentityCapabilityConfig,
  type HclProfileCapabilityConfig,
  type HclOrderCapabilityConfig,
  type HclOrderSearchCapabilityConfig,
} from '../schema/capabilities.schema.js';
import {
  HclConfigurationSchema,
  type HclConfiguration,
} from '../schema/configuration.schema.js';
import {
  type HclClientFromCapabilities,
  resolveCapabilityWithFactory,
} from './initialize.types.js';
import { HclClient } from './client.js';
import {
  HclCartFactory,
  HclCategoryFactory,
  HclCheckoutFactory,
  HclIdentityFactory,
  HclInventoryFactory,
  HclOrderFactory,
  HclOrderSearchFactory,
  HclPriceFactory,
  HclProductFactory,
  HclProductSearchFactory,
  HclProfileFactory,
} from '../factories/index.js';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclCheckoutCapability } from '../capabilities/checkout.capability.js';
import { HclProductCapability } from '../capabilities/product.capability.js';
import { HclCategoryCapability } from '../capabilities/category.capability.js';
import { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import { HclPriceCapability } from '../capabilities/price.capability.js';
import { HclInventoryCapability } from '../capabilities/inventory.capability.js';
import { HclIdentityCapability } from '../capabilities/identity.capability.js';
import { HclProfileCapability } from '../capabilities/profile.capability.js';
import { HclOrderCapability } from '../capabilities/order.capability.js';
import { HclOrderSearchCapability } from '../capabilities/order-search.capability.js';
import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartSchema,
  CheckoutSchema,
  InventorySchema,
  PaymentMethodSchema,
  PriceSchema,
  ProductSearchResultSchema,
  ShippingMethodSchema,
} from '@reactionary/core';

export function withHclCapabilities<T extends HclCapabilities>(
  configuration: HclConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): HclClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const config = HclConfigurationSchema.parse(configuration);
    const caps = HclCapabilitiesSchema.parse(capabilities);
    const hclClient = new HclClient(config, context);

    const buildCapabilityArgs = <TFactory>(factory: TFactory) => ({
      cache,
      context,
      config,
      hclClient,
      factory,
    });

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityWithFactory(
        capabilities.cart as HclCartCapabilityConfig | undefined,
        {
          factory: new HclCartFactory(
            CartSchema,
            CartIdentifierSchema,
            CartPaginatedSearchResultSchema,
          ),
          capability: (args) =>
            new HclCartCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.checkout?.enabled) {
      client.checkout = resolveCapabilityWithFactory(
        capabilities.checkout as HclCheckoutCapabilityConfig | undefined,
        {
          factory: new HclCheckoutFactory(
            CheckoutSchema,
            ShippingMethodSchema,
            PaymentMethodSchema,
          ),
          capability: (args) =>
            new HclCheckoutCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.product?.enabled) {
      client.product = resolveCapabilityWithFactory(
        capabilities.product as HclProductCapabilityConfig | undefined,
        {
          factory: new HclProductFactory(ProductSchema),
          capability: (args) =>
            new HclProductCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.category?.enabled) {
      client.category = resolveCapabilityWithFactory(
        capabilities.category as HclCategoryCapabilityConfig | undefined,
        {
          factory: new HclCategoryFactory(
            HclCategorySchema,
            CategoryPaginatedResultSchema,
          ),
          capability: (args) =>
            new HclCategoryCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.productSearch?.enabled) {
      client.productSearch = resolveCapabilityWithFactory(
        capabilities.productSearch as
          | HclProductSearchCapabilityConfig
          | undefined,
        {
          factory: new HclProductSearchFactory(ProductSearchResultSchema),
          capability: (args) =>
            new HclProductSearchCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.price?.enabled) {
      client.price = resolveCapabilityWithFactory(
        capabilities.price as HclPriceCapabilityConfig | undefined,
        {
          factory: new HclPriceFactory(PriceSchema),
          capability: (args) =>
            new HclPriceCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.inventory?.enabled) {
      client.inventory = resolveCapabilityWithFactory(
        capabilities.inventory as HclInventoryCapabilityConfig | undefined,
        {
          factory: new HclInventoryFactory(InventorySchema),
          capability: (args) =>
            new HclInventoryCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveCapabilityWithFactory(
        capabilities.identity as HclIdentityCapabilityConfig | undefined,
        {
          factory: new HclIdentityFactory(IdentitySchema),
          capability: (args) =>
            new HclIdentityCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.profile?.enabled) {
      client.profile = resolveCapabilityWithFactory(
        capabilities.profile as HclProfileCapabilityConfig | undefined,
        {
          factory: new HclProfileFactory(ProfileSchema),
          capability: (args) =>
            new HclProfileCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.order?.enabled) {
      client.order = resolveCapabilityWithFactory(
        capabilities.order as HclOrderCapabilityConfig | undefined,
        {
          factory: new HclOrderFactory(OrderSchema),
          capability: (args) =>
            new HclOrderCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.orderSearch?.enabled) {
      client.orderSearch = resolveCapabilityWithFactory(
        capabilities.orderSearch as HclOrderSearchCapabilityConfig | undefined,
        {
          factory: new HclOrderSearchFactory(OrderSearchResultSchema),
          capability: (args) =>
            new HclOrderSearchCapability(
              args.cache,
              args.context,
              args.config,
              args.hclClient,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    return client as HclClientFromCapabilities<T>;
  };
}
