import { Client } from "@reactionary/core";
import { PosthogConfiguration } from "../schema/configuration.schema";
import { PosthogCapabilities } from "../schema/capabilities.schema";
import { PosthogAnalyticsProvider } from "../providers/analytics.provider";

export function withPosthogCapabilities(configuration: PosthogConfiguration, capabilities: PosthogCapabilities) {
    const client: Partial<Client> = {};

    if (capabilities.analytics) {
        client.analytics = [new PosthogAnalyticsProvider(configuration)];
    }

    return client;
}
