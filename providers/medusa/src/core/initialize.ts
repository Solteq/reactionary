import type {
  Cache,
  CartProvider,
  ProductProvider,
} from "@reactionary/core";
import {
  CartSchema,
  ProductSchema,
  ProductSearchResultItemSchema
} from "@reactionary/core";
import { MedusaCartProvider } from "../providers/cart.provider.js";
import type { MedusaCapabilities } from "../schema/capabilities.schema.js";
import type { MedusaConfiguration } from "../schema/configuration.schema.js";
import { MedusaSearchProvider } from "../providers/product-search.provider.js";
import { MedusaProductProvider } from "../providers/product.provider.js";

type MedusaClient<T extends MedusaCapabilities> =
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) ;
export function withMedusaCapabilities<T extends MedusaCapabilities>(
    configuration: MedusaConfiguration,
    capabilities: T
) {
    return (cache: Cache): MedusaClient<T> => {
        const client: any = {};

        if (capabilities.productSearch) {
            client.productSearch = new MedusaSearchProvider(configuration, ProductSearchResultItemSchema, cache);
        }

        if (capabilities.product) {
            client.product = new MedusaProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.cart) {
            client.cart = new MedusaCartProvider(configuration, CartSchema, cache);
        }

        return client;
    };
}
