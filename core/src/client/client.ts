import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";
import { Product } from "../schemas/product.schema";

export interface Client {
    product: ProductProvider<Product>,
    search: SearchProvider,
    cache: Cache
}

export function buildClient<T extends Partial<Client>>(providers: Array<T>): T {
    let client = {
    } as T;

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }
    }

    return client;
}
