import { Client, RedisCache } from "@reactionary/core";
import { PosthogConfiguration } from "../schema/configuration.schema";
import { PosthogCapabilities } from "../schema/capabilities.schema";

export function withPosthogCapabilities(configuration: PosthogConfiguration, capabilities: PosthogCapabilities) {
    return (cache: RedisCache) => {
        const client: Partial<Client> = {};

        return client;
    };
}
