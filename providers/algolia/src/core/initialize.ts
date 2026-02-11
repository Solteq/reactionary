import type { Cache, ClientFromCapabilities, RequestContext } from "@reactionary/core";
import { AlgoliaProductSearchProvider } from "../providers/product-search.provider.js";
import type { AlgoliaCapabilities } from "../schema/capabilities.schema.js";
import type { AlgoliaConfiguration } from "../schema/configuration.schema.js";
import { AlgoliaAnalyticsProvider } from "../providers/analytics.provider.js";
import { AlgoliaProductRecommendationsProvider } from "../providers/product-recommendations.provider.js";

export function withAlgoliaCapabilities<T extends AlgoliaCapabilities>(configuration: AlgoliaConfiguration, capabilities: T) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = {};

        if (capabilities.productSearch) {
            client.productSearch = new AlgoliaProductSearchProvider(cache, context, configuration);
        }

        if (capabilities.analytics) {
            client.analytics = new AlgoliaAnalyticsProvider(cache, context, configuration);
        }

        if (capabilities.productRecommendations) {
            client.productRecommendations = new AlgoliaProductRecommendationsProvider(configuration, cache, context);
        }

        return client;
    };
}
