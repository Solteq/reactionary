import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";
import { Product } from "../schemas/product.schema";

export interface Client {
    product: ProductProvider<Product>,
    search: SearchProvider
}

export function buildClient(providers: Array<Partial<Client>>) {
    let client = {} as Client;

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }
    }

    return client;
}