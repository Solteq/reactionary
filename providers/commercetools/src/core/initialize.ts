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
    OrderProvider,
    RequestContext
    } from "@reactionary/core";
import {
    CartSchema,
    IdentitySchema,
    InventorySchema,
    PriceSchema,
    ProductSchema,
    CategorySchema,
    CheckoutSchema,
    ProductSearchResultItemSchema
} from "@reactionary/core";
import { CommercetoolsCapabilitiesSchema, type CommercetoolsCapabilities } from "../schema/capabilities.schema.js";
import { CommercetoolsSearchProvider } from "../providers/product-search.provider.js";
import { CommercetoolsProductProvider } from '../providers/product.provider.js';
import { CommercetoolsConfigurationSchema, type CommercetoolsConfiguration } from "../schema/configuration.schema.js";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider.js";
import { CommercetoolsCartProvider } from "../providers/cart.provider.js";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider.js";
import { CommercetoolsPriceProvider } from "../providers/price.provider.js";
import { CommercetoolsCategoryProvider } from "../providers/category.provider.js";
import { CommercetoolsCheckoutProvider } from "../providers/index.js";
import { CommercetoolsClient } from "./client.js";

type CommercetoolsProviderSet<T extends CommercetoolsCapabilities> =
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
    return (cache: Cache, context: RequestContext): CommercetoolsProviderSet<T> => {
        const client: any = {};
        const config = CommercetoolsConfigurationSchema.parse(configuration);
        const caps = CommercetoolsCapabilitiesSchema.parse(capabilities);
        const commercetoolsClient = new CommercetoolsClient(config, context);

        if (caps.product) {
            client.product = new CommercetoolsProductProvider(config, ProductSchema, cache, context, commercetoolsClient);
        }

        if (caps.productSearch) {
            client.productSearch = new CommercetoolsSearchProvider(config, ProductSearchResultItemSchema, cache, context, commercetoolsClient);
        }

        if (caps.identity) {
            client.identity = new CommercetoolsIdentityProvider(config, IdentitySchema, cache, context, commercetoolsClient);
        }

        if (caps.cart) {
            client.cart = new CommercetoolsCartProvider(config, CartSchema, cache, context, commercetoolsClient);
        }

        if (caps.inventory) {
            client.inventory = new CommercetoolsInventoryProvider(config, InventorySchema, cache, context, commercetoolsClient);
        }

        if (caps.price) {
            client.price = new CommercetoolsPriceProvider(config, PriceSchema, cache, context, commercetoolsClient);
        }

        if (caps.category) {
            client.category = new CommercetoolsCategoryProvider(config, CategorySchema, cache, context, commercetoolsClient);
        }

        if (caps.checkout) {
          client.checkout = new CommercetoolsCheckoutProvider(config, CheckoutSchema, cache, context, commercetoolsClient);
        }


        return client;
    };
}
