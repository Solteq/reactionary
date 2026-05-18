import type { Cache, RequestContext } from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
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
  HclCategoryFactory,
  HclProductFactory,
  HclProductSearchFactory,
} from '../factories/index.js';
import { HclProductCapability } from '../capabilities/product.capability.js';
import { HclCategoryCapability } from '../capabilities/category.capability.js';
import { HclProductSearchCapability } from '../capabilities/product-search.capability.js';
import { ProductSearchResultSchema } from '@reactionary/core';

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
    const hclClient = new HclClient(config);

    const buildCapabilityArgs = <TFactory>(
      factory: TFactory,
    ): HclCapabilityFactoryArgs & { factory: TFactory } => ({
      cache,
      context,
      config,
      hclClient,
      factory,
    });

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

    return client as HclClientFromCapabilities<T>;
  };
}
