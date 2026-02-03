import type { Cache, ClientFromCapabilities, RequestContext } from "@reactionary/core";
import { AlgoliaSearchProvider } from "../providers/product-search.provider.js";
import type { AlgoliaCapabilities } from "../schema/capabilities.schema.js";
import type { AlgoliaConfiguration } from "../schema/configuration.schema.js";
import { AlgoliaAnalyticsProvider } from "../providers/analytics.provider.js";

export function withAlgoliaCapabilities<T extends AlgoliaCapabilities>(configuration: AlgoliaConfiguration, capabilities: T) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        const client: any = {};

        if (capabilities.productSearch) {
            client.productSearch = new AlgoliaSearchProvider(configuration, cache, context);
        }

        if (capabilities.analytics) {
            client.analytics = new AlgoliaAnalyticsProvider(cache, context, configuration);
        }

        return client;
    };
}
