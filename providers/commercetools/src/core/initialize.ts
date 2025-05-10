import { Client, ProductSchema } from "@reactionary/core";
import { CommercetoolsConfig } from "./configuration";
import { CommercetoolsCapabilities } from "./capabilities";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';

export function withCommercetoolsCapabilities(configuration: CommercetoolsConfig, capabilities: Partial<CommercetoolsCapabilities>) {
    const client = {} as Client;

    if (capabilities.products) {
        client.product = new CommercetoolsProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new CommercetoolsSearchProvider(configuration);
    }

    return client;
}
