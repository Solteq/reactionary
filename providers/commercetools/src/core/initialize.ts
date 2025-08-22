import { CartMutationSchema, CartQuerySchema, CartSchema, Client, IdentityMutationSchema, IdentityQuerySchema, IdentitySchema, InventoryQuerySchema, InventorySchema, PriceMutationSchema, PriceQuerySchema, PriceSchema, ProductMutationSchema, ProductQuerySchema, ProductSchema, SearchMutationSchema, SearchQuerySchema, SearchResultSchema, RedisCache } from "@reactionary/core";
import { CommercetoolsCapabilities } from "../schema/capabilities.schema";
import { CommercetoolsSearchProvider } from "../providers/search.provider";
import { CommercetoolsProductProvider } from '../providers/product.provider';
import { CommercetoolsConfiguration } from "../schema/configuration.schema";
import { CommercetoolsIdentityProvider } from "../providers/identity.provider";
import { CommercetoolsCartProvider } from "../providers/cart.provider";
import { CommercetoolsInventoryProvider } from "../providers/inventory.provider";
import { CommercetoolsPriceProvider } from "../providers/price.provider";
import { InventoryMutationSchema } from "core/src/schemas/mutations/inventory.mutation";

export function withCommercetoolsCapabilities(
    configuration: CommercetoolsConfiguration, 
    capabilities: CommercetoolsCapabilities
) {
    return (cache: RedisCache) => {
        const client: Partial<Client> = {};

        if (capabilities.product) {
            client.product = new CommercetoolsProductProvider(configuration, ProductSchema, ProductQuerySchema, ProductMutationSchema, cache);
        }

        if (capabilities.search) {
            client.search = new CommercetoolsSearchProvider(configuration, SearchResultSchema, SearchQuerySchema, SearchMutationSchema, cache);
        }

        if (capabilities.identity) {
            client.identity = new CommercetoolsIdentityProvider(configuration, IdentitySchema, IdentityQuerySchema, IdentityMutationSchema, cache);
        }

        if (capabilities.cart) {
            client.cart = new CommercetoolsCartProvider(configuration, CartSchema, CartQuerySchema, CartMutationSchema, cache);
        }

        if (capabilities.inventory) {
            client.inventory = new CommercetoolsInventoryProvider(configuration, InventorySchema, InventoryQuerySchema, InventoryMutationSchema, cache);
        }

        if (capabilities.price) {
            client.price = new CommercetoolsPriceProvider(configuration, PriceSchema, PriceQuerySchema, PriceMutationSchema, cache);
        }

        return client;
    };
}
