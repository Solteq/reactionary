import type {
    Cache,
    ProductProvider,
    ProductSearchProvider,
    IdentityProvider,
    CartProvider,
    InventoryProvider,
    PriceProvider,
    CategoryProvider,
    StoreProvider,
    CheckoutProvider,
    OrderProvider
    } from "@reactionary/core";
import {
    CartSchema,
    IdentitySchema,
    InventorySchema,
    PriceSchema,
    ProductSchema,
    ProductSearchResultSchema,
    CategorySchema,
    CheckoutSchema,
    ProductSearchResultItemSchema
} from "@reactionary/core";
import type { CommercetoolsCapabilities } from "../schema/capabilities.schema.js";
import { CommercetoolsSearchProvider } from "../providers/product-search.provider.js";
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import type { CommercetoolsConfiguration } from "../schema/configuration.schema.js";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider.js";
import { CommercetoolsCartProvider } from "../providers/cart.provider.js";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider.js";
import { CommercetoolsPriceProvider } from "../providers/price.provider.js";
import { CommercetoolsCategoryProvider } from "../providers/category.provider.js";
import { CommercetoolsCheckoutProvider } from "../providers/index.js";

type CommercetoolsClient<T extends CommercetoolsCapabilities> =
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) &
    (T['productSearch'] extends true ? { productSearch: ProductSearchProvider } : object) &
    (T['identity'] extends true ? { identity: IdentityProvider } : object) &
    (T['category'] extends true ? { category: CategoryProvider } : object) &
    (T['inventory'] extends true ? { inventory: InventoryProvider } : object) &
    (T['price'] extends true ? { price: PriceProvider } : object) &
    (T['store'] extends true ? { store: StoreProvider } : object) &
    (T['order'] extends true ? { order: OrderProvider } : object) &
    (T['checkout'] extends true ? { checkout: CheckoutProvider } : object) ;
export function withCommercetoolsCapabilities<T extends CommercetoolsCapabilities>(
    configuration: CommercetoolsConfiguration,
    capabilities: T
) {
    return (cache: Cache): CommercetoolsClient<T> => {
        const client: any = {};

        if (capabilities.product) {
            client.product = new CommercetoolsProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.productSearch) {
            client.search = new CommercetoolsSearchProvider(configuration, ProductSearchResultItemSchema, cache);
        }

        if (capabilities.identity) {
            client.identity = new CommercetoolsIdentityProvider(configuration, IdentitySchema, cache);
        }

        if (capabilities.cart) {
            client.cart = new CommercetoolsCartProvider(configuration, CartSchema, cache);
        }

        if (capabilities.inventory) {
            client.inventory = new CommercetoolsInventoryProvider(configuration, InventorySchema, cache);
        }

        if (capabilities.price) {
            client.price = new CommercetoolsPriceProvider(configuration, PriceSchema, cache);
        }

        if (capabilities.category) {
            client.category = new CommercetoolsCategoryProvider(configuration, CategorySchema, cache);
        }

        if (capabilities.checkout) {
          client.checkout = new CommercetoolsCheckoutProvider(configuration, CheckoutSchema, cache);
        }


        return client;
    };
}
