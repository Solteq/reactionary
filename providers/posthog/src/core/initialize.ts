import type { Client, Cache } from "@reactionary/core";
import type { PosthogConfiguration } from "../schema/configuration.schema.js";
import type { PosthogCapabilities } from "../schema/capabilities.schema.js";

export function withPosthogCapabilities(_configuration: PosthogConfiguration, _capabilities: PosthogCapabilities) {
    return (_cache: Cache) => {
        const client: Partial<Client> = {};

        return client;
    };
}
