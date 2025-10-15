import type { AnalyticsProvider } from "../providers/analytics.provider.js";
import type { ProductProvider } from "../providers/product.provider.js";
import type { SearchProvider } from "../providers/search.provider.js";
import type { IdentityProvider } from '../providers/identity.provider.js';
import type { CartProvider } from "../providers/cart.provider.js";
import type { PriceProvider } from "../providers/price.provider.js";
import type { InventoryProvider } from "../providers/inventory.provider.js";
import type { Cache } from "../cache/cache.interface.js";
import { RedisCache } from "../cache/redis-cache.js";
import type { CategoryProvider } from "../providers/category.provider.js";
import type { CheckoutProvider } from "../providers/index.js";

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    identity: IdentityProvider,
    cache: Cache,
    cart: CartProvider,
    checkout: CheckoutProvider,
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
