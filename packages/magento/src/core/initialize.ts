import type {
  Cache,
  RequestContext,
} from '@reactionary/core';
import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartSchema,
  CategoryPaginatedResultSchema,
  CategorySchema,
  InventorySchema,
  PriceSchema,
  ProductSchema,
  ProductSearchResultSchema,
} from '@reactionary/core';
import { MagentoCartCapability } from '../capabilities/cart.capability.js';
import { MagentoCategoryCapability } from '../capabilities/category.capability.js';
import { MagentoIdentityCapability } from '../capabilities/identity.capability.js';
import { MagentoInventoryCapability } from '../capabilities/inventory.capability.js';
import { MagentoPriceCapability } from '../capabilities/price.capability.js';
import { MagentoProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MagentoProductCapability } from '../capabilities/product.capability.js';
import {
  MagentoCapabilitiesSchema,
  type MagentoCapabilities,
} from '../schema/capabilities.schema.js';
import {
  MagentoConfigurationSchema,
  type MagentoConfiguration,
} from '../schema/configuration.schema.js';
import { MagentoClient } from './client.js';
import {
  MagentoCartFactory,
  MagentoCategoryFactory,
  MagentoInventoryFactory,
  MagentoPriceFactory,
  MagentoProductFactory,
  MagentoProductSearchFactory,
} from '../factories/index.js';
import {
  type MagentoClientFromCapabilities,
  resolveCapabilityWithFactory,
  resolveDirectCapability,
} from './initialize.types.js';

export function withMagentoCapabilities<T extends MagentoCapabilities>(
  configuration: MagentoConfiguration,
  capabilities: T,
) {
  return (
    cache: Cache,
    context: RequestContext,
  ): MagentoClientFromCapabilities<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {};
    const config = MagentoConfigurationSchema.parse(configuration);
    const caps = MagentoCapabilitiesSchema.parse(capabilities);
    const magentoApi = new MagentoClient(config, context);

    const buildCapabilityArgs = <TFactory,>(factory: TFactory) => ({
      cache,
      context,
      config,
      magentoApi,
      factory,
    });

    if (caps.product?.enabled) {
      client.product = resolveCapabilityWithFactory(
        capabilities.product,
        {
          factory: new MagentoProductFactory(ProductSchema, config),
          capability: (args) =>
            new MagentoProductCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
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
          factory: new MagentoProductSearchFactory(ProductSearchResultSchema, config),
          capability: (args) =>
            new MagentoProductSearchCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
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
          factory: new MagentoCategoryFactory(
            CategorySchema,
            CategoryPaginatedResultSchema,
          ),
          capability: (args) =>
            new MagentoCategoryCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.cart?.enabled) {
      client.cart = resolveCapabilityWithFactory(
        capabilities.cart,
        {
          factory: new MagentoCartFactory(
            CartSchema,
            CartIdentifierSchema,
            CartPaginatedSearchResultSchema,
          ),
          capability: (args) =>
            new MagentoCartCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
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
          factory: new MagentoPriceFactory(PriceSchema),
          capability: (args) =>
            new MagentoPriceCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
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
          factory: new MagentoInventoryFactory(InventorySchema),
          capability: (args) =>
            new MagentoInventoryCapability(
              args.config,
              args.cache,
              args.context,
              args.magentoApi,
              args.factory,
            ),
        },
        buildCapabilityArgs,
      );
    }

    if (caps.identity?.enabled) {
      client.identity = resolveDirectCapability(
        capabilities.identity,
        (args) =>
          new MagentoIdentityCapability(
            args.config,
            args.cache,
            args.context,
            args.magentoApi,
          ),
        {
          cache,
          context,
          config,
          magentoApi,
        },
      );
    }

    return client;
  };
}
