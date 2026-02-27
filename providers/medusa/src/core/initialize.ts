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
import { MedusaProductRecommendationsProvider } from "../providers/product-recommendations.provider.js";
import { MedusaProductProvider } from "../providers/product.provider.js";
import { MedusaProductAssociationsProvider } from "../providers/product-associations.provider.js";
import { MedusaProfileProvider } from "../providers/profile.provider.js";
import { MedusaCapabilitiesSchema, type MedusaCapabilities } from "../schema/capabilities.schema.js";
import { MedusaConfigurationSchema, type MedusaConfiguration } from "../schema/configuration.schema.js";
import { MedusaAPI } from "./client.js";

export function withMedusaCapabilities<T extends MedusaCapabilities>(
    configuration: MedusaConfiguration,
    capabilities: T
) {
    return (cache: Cache, context: RequestContext): ClientFromCapabilities<T> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = {};
        const config = MedusaConfigurationSchema.parse(configuration);
        const caps = MedusaCapabilitiesSchema.parse(capabilities);

        const medusaApi = new MedusaAPI(config, context);


        if (caps.productSearch) {
            client.productSearch = new MedusaSearchProvider(configuration, cache, context, medusaApi);
        }

        if (caps.productRecommendations) {
            client.productRecommendations = new MedusaProductRecommendationsProvider(configuration, cache, context, medusaApi);
        }

        if (caps.category) {
            client.category = new MedusaCategoryProvider(configuration, cache, context, medusaApi);
        }

        if (caps.checkout) {
            client.checkout = new MedusaCheckoutProvider(configuration, cache, context, medusaApi);
        }

        if (caps.product) {
            client.product = new MedusaProductProvider(configuration, cache, context, medusaApi);
        }

        if (caps.cart) {
            client.cart = new MedusaCartProvider(configuration, cache, context, medusaApi);
        }

        if (caps.price) {
            client.price = new MedusaPriceProvider(configuration, cache, context, medusaApi);
        }

        if (caps.inventory) {
            client.inventory = new MedusaInventoryProvider(configuration, cache, context, medusaApi);
        }

        if (caps.identity) {
            client.identity = new MedusaIdentityProvider(configuration, cache, context, medusaApi);
        }
        if (caps.profile) {
            client.profile = new MedusaProfileProvider(configuration, cache, context, medusaApi);
        }

        if (caps.order) {
            client.order = new MedusaOrderProvider(configuration, cache, context, medusaApi);
        }

        if(caps.orderSearch) {
            client.orderSearch = new MedusaOrderSearchProvider(configuration, cache, context, medusaApi);
        }
        if (caps.productAssociations) {
            client.productAssociations = new MedusaProductAssociationsProvider(configuration, cache, context, medusaApi);
        }
        return client;
    };
}
