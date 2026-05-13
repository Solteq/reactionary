import type { Cache, RequestContext } from '@reactionary/core';
import { ProductSchema } from '@reactionary/core';
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
import { HclProductFactory } from '../factories/index.js';
import { HclProductCapability } from '../capabilities/product.capability.js';

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

    return client as HclClientFromCapabilities<T>;
  };
}
