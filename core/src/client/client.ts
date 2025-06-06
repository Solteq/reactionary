import { AnalyticsProvider } from "../providers/analytics.provider";
import { ProductProvider } from "../providers/product.provider";
import { SearchProvider } from "../providers/search.provider";
import { IdentityProvider } from '../providers/identity.provider';

export interface Client {
    product: ProductProvider,
    search: SearchProvider,
    identity: IdentityProvider,
    cache: Cache,
    analytics: Array<AnalyticsProvider>
}

export function buildClient<T extends Partial<Client>>(providers: Array<T>): Required<T> {
    let client = { } as Required<T>;

    const mergedAnalytics = [];

    for (const provider of providers) {
        client = {
            ...client,
            ...provider
        }

        if (provider.analytics) {
            mergedAnalytics.push(...provider.analytics);
        }
    }

    client.analytics = mergedAnalytics;

    return client satisfies T;
}
