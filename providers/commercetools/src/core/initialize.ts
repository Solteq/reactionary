import type {
    Cache,
    ProductProvider,
    SearchProvider,
    IdentityProvider,
    CartProvider,
    InventoryProvider,
    PriceProvider,
    CategoryProvider} from "@reactionary/core";
import {
    CartSchema,
    IdentitySchema,
    InventorySchema,
    PriceSchema,
    ProductSchema,
    SearchResultSchema,
    CategorySchema,
    CartPaymentInstructionSchema
} from "@reactionary/core";
import type { CommercetoolsCapabilities } from "../schema/capabilities.schema";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';
import type { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider";
import { CommercetoolsCartProvider } from "../providers/cart.provider";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider";
import { CommercetoolsPriceProvider } from "../providers/price.provider";
import { CommercetoolsCategoryProvider } from "../providers/category.provider";
import { CommercetoolsCartPaymentProvider } from "../providers/cart-payment.provider";

type CommercetoolsClient<T extends CommercetoolsCapabilities> =
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) &
    (T['search'] extends true ? { search: SearchProvider } : object) &
    (T['identity'] extends true ? { identity: IdentityProvider } : object) &
    (T['category'] extends true ? { category: CategoryProvider } : object) &
    (T['inventory'] extends true ? { inventory: InventoryProvider } : object) &
    (T['price'] extends true ? { price: PriceProvider } : object);

export function withCommercetoolsCapabilities<T extends CommercetoolsCapabilities>(
    configuration: CommercetoolsConfiguration,
    capabilities: T
) {
    return (cache: Cache): CommercetoolsClient<T> => {
        const client: any = {};

        if (capabilities.product) {
            client.product = new CommercetoolsProductProvider(configuration, ProductSchema, cache);
        }

        if (capabilities.search) {
            client.search = new CommercetoolsSearchProvider(configuration, SearchResultSchema, cache);
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

        if (capabilities.cartPayment) {
          client.cartPayment = new CommercetoolsCartPaymentProvider(configuration, CartPaymentInstructionSchema, cache);
        }


        return client;
    };
}
