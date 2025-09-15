import { CartSchema, Client, IdentitySchema, InventorySchema, PriceSchema, ProductSchema, SearchResultSchema, Cache } from "@reactionary/core";
import { CommercetoolsCapabilities } from "../schema/capabilities.schema";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';
import { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider";
import { CommercetoolsCartProvider } from "../providers/cart.provider";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider";
import { CommercetoolsPriceProvider } from "../providers/price.provider";

export function withCommercetoolsCapabilities(
    configuration: CommercetoolsConfiguration, 
    capabilities: CommercetoolsCapabilities
) {
    return (cache: Cache) => {
        const client: Partial<Client> = {};

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

        return client;
    };
}