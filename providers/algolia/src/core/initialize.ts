import type { Cache, ProductSearchProvider, RequestContext } from "@reactionary/core";
import { ProductSearchResultItemSchema } from "@reactionary/core";
import { AlgoliaSearchProvider } from "../providers/product-search.provider.js";
import type { AlgoliaCapabilities } from "../schema/capabilities.schema.js";
import type { AlgoliaConfiguration } from "../schema/configuration.schema.js";

type AlgoliaClient<T extends AlgoliaCapabilities> =
    (T['productSearch'] extends true ? { productSearch: ProductSearchProvider } : object);

export function withAlgoliaCapabilities<T extends AlgoliaCapabilities>(configuration: AlgoliaConfiguration, capabilities: T) {
    return (cache: Cache, context: RequestContext): AlgoliaClient<T> => {
        const client: any = {};

        if (capabilities.productSearch) {
            client.productSearch = new AlgoliaSearchProvider(configuration, ProductSearchResultItemSchema, cache, context);
        }

        return client;
    };
}
