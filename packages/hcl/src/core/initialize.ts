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

    const buildCapabilityArgs = <TFactory>(factory: TFactory) => ({
      cache,
      context,
      config,
      hclClient,
      factory,
    });

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityWithFactory(
        capabilities.cart,
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
        capabilities.checkout,
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
        capabilities.product,
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
        capabilities.category,
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
        capabilities.productSearch,
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
        capabilities.price,
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
        capabilities.inventory,
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
        capabilities.identity,
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

    return client as HclClientFromCapabilities<T>;
  };
}
