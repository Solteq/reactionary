import type { Cache, ClientFromCapabilities, RequestContext } from "@reactionary/core";
import type { GoogleAnalyticsCapabilities } from "../schema/capabilities.schema.js";
import type { GoogleAnalyticsConfiguration } from "../schema/configuration.schema.js";
import { GoogleAnalyticsAnalyticsProvider } from "../providers/analytics.provider.js";

export function googleAnalyticsCapabilities<T extends GoogleAnalyticsCapabilities>(configuration: GoogleAnalyticsConfiguration, capabilities: T) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        const client: any = {};

        if (capabilities.analytics) {
            client.analytics = new GoogleAnalyticsAnalyticsProvider(cache, context, configuration);
        }

        return client;
    };
}
