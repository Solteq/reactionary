import { AnalyticsProvider } from "../providers/analytics.provider";
import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";
import { IdentityProvider } from '../providers/identity.provider';
import { CartProvider } from "../providers/cart.provider";
import { PriceProvider } from "../providers/price.provider";
import { InventoryProvider } from "../providers/inventory.provider";
import { RedisCache } from "../cache/redis-cache";
import { UnifiedCachingStrategy } from "../cache/caching-strategy";

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    identity: IdentityProvider,
    cache: RedisCache,
    cart: CartProvider,
    analytics: Array<AnalyticsProvider>,
    price: PriceProvider,
    inventory: InventoryProvider
}

export interface BuildClientOptions {
    cache?: RedisCache;
}

export function buildClient<T extends Partial<Client>>(
    providerFactories: Array<(cache: RedisCache) => T>,
    options: BuildClientOptions = {}
): Required<T> {
    let client = { } as Required<T>;

    // Create shared cache instance
    const sharedCache = options.cache || new RedisCache(new UnifiedCachingStrategy());

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
export function createCache(strategy?: UnifiedCachingStrategy): RedisCache {
    return new RedisCache(strategy || new UnifiedCachingStrategy());
}
