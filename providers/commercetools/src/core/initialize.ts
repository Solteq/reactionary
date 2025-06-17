import { CartSchema, Client, IdentitySchema, InventorySchema, PriceSchema, ProductSchema, SearchResultSchema } from "@reactionary/core";
import { CommercetoolsCapabilities } from "../schema/capabilities.schema";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';
import { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider";
import { CommercetoolsCartProvider } from "../providers/cart.provider";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider";
import { CommercetoolsPriceProvider } from "../providers/price.provider";

export function withCommercetoolsCapabilities(configuration: CommercetoolsConfiguration, capabilities: CommercetoolsCapabilities) {
    const client: Partial<Client> = {};

    if (capabilities.product) {
        client.product = new CommercetoolsProductProvider(configuration, ProductSchema);
    }

    if (capabilities.search) {
        client.search = new CommercetoolsSearchProvider(configuration, SearchResultSchema);
    }

    if (capabilities.identity) {
        client.identity = new CommercetoolsIdentityProvider(configuration, IdentitySchema);
    }

    if (capabilities.cart) {
        client.cart = new CommercetoolsCartProvider(configuration, CartSchema);
    }

    if (capabilities.inventory) {
        client.inventory = new CommercetoolsInventoryProvider(configuration, InventorySchema);
    }

    if (capabilities.price) {
        client.price = new CommercetoolsPriceProvider(configuration, PriceSchema);
    }

    return client;
}
