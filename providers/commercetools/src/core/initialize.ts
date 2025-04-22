import { Client } from "@reactionary/core";
import { CommercetoolsConfig } from "./configuration";
import { CommercetoolsCapabilities } from "./capabilities";
import { CommercetoolsProductProvider } from "../providers/product.provider";
import { CommercetoolsSearchProvider } from "../providers/search.provider";

export function withCommercetoolsCapabilities(configuration: CommercetoolsConfig, capabilities: Partial<CommercetoolsCapabilities>): Partial<Client> {
    const client = {} as Partial<Client>;

    if (capabilities.products) {
        client.product = new CommercetoolsProductProvider(configuration);
    }

    if (capabilities.search) {
        client.search = new CommercetoolsSearchProvider(configuration);
    }

    return client;
}