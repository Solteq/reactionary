import { AnalyticsProvider } from "../providers/analytics.provider";
import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";
import { IdentityProvider } from '../providers/identity.provider';
import { CartProvider } from "../providers/cart.provider";
import { PriceProvider } from "../providers/price.provider";
import { InventoryProvider } from "../providers/inventory.provider";
import { Cache } from "../cache/cache.interface";
import { RedisCache } from "../cache/redis-cache";
import { CategoryProvider } from "../providers/category.provider";

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    identity: IdentityProvider,
    cache: Cache,
    cart: CartProvider,
    analytics: Array<AnalyticsProvider>,
    price: PriceProvider,
    inventory: InventoryProvider,
    category: CategoryProvider
}

export interface BuildClientOptions {
    cache?: Cache;
}

export function buildClient<T extends Partial<Client>>(
    providerFactories: Array<(cache: Cache) => T>,
    options: BuildClientOptions = {}
): Required<T> {
    let client = { } as Required<T>;

    // Create shared cache instance
    const sharedCache = options.cache || new RedisCache();

    const mergedAnalytics = [];

    for (const factory of providerFactories) {
        const provider = factory(sharedCache);
        client = {
            ...client,
            ...provider
        }

        if (provider.analytics) {
            mergedAnalytics.push(...provider.analytics);
        }
    }

    client.analytics = mergedAnalytics;

    // Add cache to complete the client
    const completeClient = {
        ...client,
        cache: sharedCache
    } as Required<T>;

    return completeClient;
}

// Convenience function to create a shared cache instance
export function createCache(): Cache {
    return new RedisCache();
}
