import type {
  Cache,
  ClientFromCapabilities,
  RequestContext
} from "@reactionary/core";
import { MedusaCartProvider } from "../providers/cart.provider.js";
import { MedusaCategoryProvider } from "../providers/category.provider.js";
import { MedusaCheckoutProvider } from "../providers/checkout.provider.js";
import { MedusaIdentityProvider } from "../providers/identity.provider.js";
import { MedusaInventoryProvider } from "../providers/inventory.provider.js";
import { MedusaOrderSearchProvider } from "../providers/order-search.provider.js";
import { MedusaOrderProvider } from "../providers/order.provider.js";
import { MedusaPriceProvider } from "../providers/price.provider.js";
import { MedusaSearchProvider } from "../providers/product-search.provider.js";
import { MedusaProductProvider } from "../providers/product.provider.js";
import { MedusaProfileProvider } from "../providers/profile.provider.js";
import { MedusaCapabilitiesSchema, type MedusaCapabilities } from "../schema/capabilities.schema.js";
import { MedusaConfigurationSchema, type MedusaConfiguration } from "../schema/configuration.schema.js";
import { MedusaClient } from "./client.js";

export function withMedusaCapabilities<T extends MedusaCapabilities>(
    configuration: MedusaConfiguration,
    capabilities: T
) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        const client: any = {};
        const config = MedusaConfigurationSchema.parse(configuration);
        const caps = MedusaCapabilitiesSchema.parse(capabilities);

        const medusaClient = new MedusaClient(config, context);


        if (caps.productSearch) {
            client.productSearch = new MedusaSearchProvider(configuration, cache, context, medusaClient);
        }

        if (caps.category) {
            client.category = new MedusaCategoryProvider(configuration, cache, context, medusaClient);
        }

        if (caps.checkout) {
            client.checkout = new MedusaCheckoutProvider(configuration, cache, context, medusaClient);
        }

        if (caps.product) {
            client.product = new MedusaProductProvider(configuration, cache, context, medusaClient);
        }

        if (caps.cart) {
            client.cart = new MedusaCartProvider(configuration, cache, context, medusaClient);
        }

        if (caps.price) {
            client.price = new MedusaPriceProvider(configuration, cache, context, medusaClient);
        }

        if (caps.inventory) {
            client.inventory = new MedusaInventoryProvider(configuration, cache, context, medusaClient);
        }

        if (caps.identity) {
            client.identity = new MedusaIdentityProvider(configuration, cache, context, medusaClient);
        }
        if (caps.profile) {
            client.profile = new MedusaProfileProvider(configuration, cache, context, medusaClient);
        }

        if (caps.order) {
            client.order = new MedusaOrderProvider(configuration, cache, context, medusaClient);
        }

        if(caps.orderSearch) {
            client.orderSearch = new MedusaOrderSearchProvider(configuration, cache, context, medusaClient);
        }

        return client;
    };
}
