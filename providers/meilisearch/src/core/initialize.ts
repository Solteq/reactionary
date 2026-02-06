import type { Cache, ClientFromCapabilities, RequestContext } from "@reactionary/core";
import { MeilisearchSearchProvider } from "../providers/product-search.provider.js";
import { MeilisearchOrderSearchProvider } from "../providers/order-search.provider.js";
import type { MeilisearchCapabilities } from "../schema/capabilities.schema.js";
import type { MeilisearchConfiguration } from "../schema/configuration.schema.js";

export function withMeilisearchCapabilities<T extends MeilisearchCapabilities>(configuration: MeilisearchConfiguration, capabilities: T) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        const client: any = {};

        if (capabilities.productSearch) {
            client.productSearch = new MeilisearchSearchProvider(configuration, cache, context);
        }

        if (capabilities.orderSearch) {
            client.orderSearch = new MeilisearchOrderSearchProvider(configuration, cache, context);
        }

        return client;
    };
}
