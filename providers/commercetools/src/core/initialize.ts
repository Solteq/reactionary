import { Client, ProductSchema, SearchResultSchema } from "@reactionary/core";
import { CommercetoolsConfig } from "./configuration";
import { CommercetoolsCapabilities } from "../schema/capabilities.schema";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';

export function withCommercetoolsCapabilities(configuration: CommercetoolsConfig, capabilities: CommercetoolsCapabilities) {
    const client: Partial<Client> = {};

    if (capabilities.product) {
        client.product = new CommercetoolsProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new CommercetoolsSearchProvider(configuration, SearchResultSchema);
    }

    return client;
}
