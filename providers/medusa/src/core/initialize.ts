import type {
  Cache,
  CartProvider,
  CategoryProvider,
  CheckoutProvider,
  PriceProvider,
  ProductProvider,
  ProductSearchProvider,
  RequestContext,
} from "@reactionary/core";
import {
  CartSchema,
  CategorySchema,
  CheckoutSchema,
  PriceSchema,
  ProductSchema,
  ProductSearchResultItemSchema
} from "@reactionary/core";
import { MedusaCartProvider } from "../providers/cart.provider.js";
import { MedusaPriceProvider } from "../providers/price.provider.js";
import { MedusaCapabilitiesSchema, type MedusaCapabilities } from "../schema/capabilities.schema.js";
import { MedusaConfigurationSchema, type MedusaConfiguration } from "../schema/configuration.schema.js";
import { MedusaSearchProvider } from "../providers/product-search.provider.js";
import { MedusaProductProvider } from "../providers/product.provider.js";
import { MedusaClient } from "./client.js";
import { MedusaCategoryProvider } from "../providers/category.provider.js";
import { MedusaCheckoutProvider } from "../providers/checkout.provider.js";

type MedusaProviderSet<T extends MedusaCapabilities> =
    (T['product-search'] extends true ? { productSearch: ProductSearchProvider } : object) &
    (T['category'] extends true ? { category: CategoryProvider } : object) &
    (T['checkout'] extends true ? { checkout: CheckoutProvider } : object) &
    (T['cart'] extends true ? { cart: CartProvider } : object) &
    (T['price'] extends true ? { price: PriceProvider } : object) &
    (T['product'] extends true ? { product: ProductProvider } : object) ;

export function withMedusaCapabilities<T extends MedusaCapabilities>(
    configuration: MedusaConfiguration,
    capabilities: T
) {
    return (cache: Cache, context: RequestContext): MedusaProviderSet<T> => {
        const client: any = {};
        const config = MedusaConfigurationSchema.parse(configuration);
        const caps = MedusaCapabilitiesSchema.parse(capabilities);

        const medusaClient = new MedusaClient(config, context);


        if (caps.productSearch) {
            client.productSearch = new MedusaSearchProvider(configuration, ProductSearchResultItemSchema, cache, context, medusaClient);
        }

        if (caps.category) {
            client.category = new MedusaCategoryProvider(configuration, CategorySchema, cache, context, medusaClient);
        }

        if (caps.checkout) {
            client.checkout = new MedusaCheckoutProvider(configuration, CheckoutSchema, cache, context, medusaClient);
        }

        if (caps.product) {
            client.product = new MedusaProductProvider(configuration, ProductSchema, cache, context, medusaClient);
        }

        if (caps.cart) {
            client.cart = new MedusaCartProvider(configuration, CartSchema, cache, context, medusaClient);
        }

        if (caps.price) {
            client.price = new MedusaPriceProvider(configuration, PriceSchema, cache, context, medusaClient);
        }

        return client;
    };
}
