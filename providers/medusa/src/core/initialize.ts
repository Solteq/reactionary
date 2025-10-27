import type {
  Cache,
  CartProvider,
  ProductProvider,
} from "@reactionary/core";
import {
  CartSchema,
  SearchResultSchema
} from "@reactionary/core";
import { MedusaCartProvider } from "../providers/cart.provider.js";
import type { MedusaCapabilities } from "../schema/capabilities.schema.js";
import type { MedusaConfiguration } from "../schema/configuration.schema.js";
import { MedusaSearchProvider } from "../providers/search.provider.js";

type MedusaClient<T extends MedusaCapabilities> =
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) ;
export function withMedusaCapabilities<T extends MedusaCapabilities>(
    configuration: MedusaConfiguration,
    capabilities: T
) {
    return (cache: Cache): MedusaClient<T> => {
        const client: any = {};

        if (capabilities.search) {
            client.search = new MedusaSearchProvider(configuration, SearchResultSchema, cache);
        }

        if (capabilities.cart) {
            client.cart = new MedusaCartProvider(configuration, CartSchema, cache);
        }

        return client;
    };
}
