import { Cache } from "../cache/cache";
import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    cache: Cache
}

export function buildClient<T extends Partial<Client>>(providers: Array<T>): T {
    let client = {
      cache: new Cache()
    } as T;

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }
    }

    return client;
}
