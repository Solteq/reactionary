import type {
  Cache,
  ClientFromCapabilities,
  RequestContext,
} from "@reactionary/core";
import { MagentoCapabilitiesSchema, type MagentoCapabilities } from "../schema/capabilities.schema.js";
import { MagentoConfigurationSchema, type MagentoConfiguration } from "../schema/configuration.schema.js";
import { MagentoProductProvider } from "../providers/product.provider.js";
import { MagentoSearchProvider } from "../providers/product-search.provider.js";
import { MagentoCategoryProvider } from "../providers/category.provider.js";
import { MagentoClient } from "./client.js";

export function withMagentoCapabilities<T extends MagentoCapabilities>(
  configuration: MagentoConfiguration,
  capabilities: T
) {
  return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
    const client: any = {};
    const config = MagentoConfigurationSchema.parse(configuration);
    const caps = MagentoCapabilitiesSchema.parse(capabilities);

    const magentoClient = new MagentoClient(config, context);

    if (caps.product) {
      client.product = new MagentoProductProvider(configuration, cache, context, magentoClient);
    }

    if (caps.productSearch) {
      client.productSearch = new MagentoSearchProvider(configuration, cache, context, magentoClient);
    }

    if (caps.category) {
      client.category = new MagentoCategoryProvider(configuration, cache, context, magentoClient);
    }

    return client;
  };
}
