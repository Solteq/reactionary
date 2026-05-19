import type { Cache, RequestContext } from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
  IdentitySchema,
  ProductSchema,
} from '@reactionary/core';
import { HclCategorySchema } from '../schema/category.schema.js';
import {
  HclCapabilitiesSchema,
  type HclCapabilities,
  type HclCapabilityFactoryArgs,
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
  HclPriceFactory,
  HclProductFactory,
  HclProductSearchFactory,
} from '../factories/index.js';
import { HclCartCapability } from '../capabilities/cart.capability.js';
import { HclCheckoutCapability } from '../capabilities/checkout.capability.js';
import { HclProductCapability } from '../capabilities/product.capability.js';
import { HclCategoryCapability } from '../capabilities/category.capability.js';
import { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import { HclPriceCapability } from '../capabilities/price.capability.js';
import { HclInventoryCapability } from '../capabilities/inventory.capability.js';
import { HclIdentityCapability } from '../capabilities/identity.capability.js';
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

    const buildCapabilityArgs = <TFactory>(
      factory: TFactory,
    ): HclCapabilityFactoryArgs & { factory: TFactory } => ({
      cache,
      context,
      config,
      hclClient,
      factory,
    });

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityWithFactory(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.cart as any,
        {
          factory: new HclCartFactory(
            CartSchema,
            CartIdentifierSchema,
            CartPaginatedSearchResultSchema,
          ),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclCartFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.checkout as any,
        {
          factory: new HclCheckoutFactory(
            CheckoutSchema,
            ShippingMethodSchema,
            PaymentMethodSchema,
          ),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclCheckoutFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.product as any,
        {
          factory: new HclProductFactory(ProductSchema),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclProductFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.category as any,
        {
          factory: new HclCategoryFactory(
            HclCategorySchema,
            CategoryPaginatedResultSchema,
          ),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclCategoryFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.productSearch as any,
        {
          factory: new HclProductSearchFactory(ProductSearchResultSchema),
          capability: (
            args: HclCapabilityFactoryArgs & {
              factory: HclProductSearchFactory;
            },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.price as any,
        {
          factory: new HclPriceFactory(PriceSchema),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclPriceFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.inventory as any,
        {
          factory: new HclInventoryFactory(InventorySchema),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclInventoryFactory },
          ) =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities.identity as any,
        {
          factory: new HclIdentityFactory(IdentitySchema),
          capability: (
            args: HclCapabilityFactoryArgs & { factory: HclIdentityFactory },
          ) =>
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

    return client as HclClientFromCapabilities<T>;
  };
}
