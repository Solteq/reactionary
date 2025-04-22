import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";

export interface Client {
    product: ProductProvider,
    search: SearchProvider
}

export function buildClient(providers: Array<Partial<Client>>): Client {
    let client = {} as Client;

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }
    }

    return client;
}