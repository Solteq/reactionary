import { Client, Cache } from "@reactionary/core";
import { PosthogConfiguration } from "../schema/configuration.schema";
import { PosthogCapabilities } from "../schema/capabilities.schema";

export function withPosthogCapabilities(_configuration: PosthogConfiguration, _capabilities: PosthogCapabilities) {
    return (_cache: Cache) => {
        const client: Partial<Client> = {};

        return client;
    };
}
