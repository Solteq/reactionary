import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    cache: Cache
}

export function buildClient<T extends Partial<Client>>(providers: Array<T>): Required<T> {
    let client = { } as Required<T>;

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }
    }

    return client satisfies T;
}
