import type { AnalyticsProvider } from "../providers/analytics.provider";
import type { ProductProvider } from "../providers/product.provider";
import type { SearchProvider } from "../providers/search.provider";
import type { IdentityProvider } from '../providers/identity.provider';
import type { CartProvider } from "../providers/cart.provider";
import type { PriceProvider } from "../providers/price.provider";
import type { InventoryProvider } from "../providers/inventory.provider";
import type { Cache } from "../cache/cache.interface";
import { RedisCache } from "../cache/redis-cache";
import type { CategoryProvider } from "../providers/category.provider";
import type { CheckoutProvider } from "../providers";

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
