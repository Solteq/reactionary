import { Cache } from "../cache/cache.interface";
import { NoOpCache } from "../cache/noop-cache";
import { Client } from "./client";
import { AnalyticsProvider } from "../providers/analytics.provider";

type CapabilityFactory<T> = (cache: Cache) => T;

type MergeCapabilities<Acc, New> = Omit<Acc, keyof New> & New;

export class ClientBuilder<TClient = object> {
    private factories: Array<CapabilityFactory<Partial<Client>>> = [];
    private cache: Cache | undefined;

    withCapability<TNew extends Partial<Client>>(
        factory: CapabilityFactory<TNew>
    ): ClientBuilder<MergeCapabilities<TClient, TNew>> {
        const newBuilder = new ClientBuilder<MergeCapabilities<TClient, TNew>>();
        newBuilder.factories = [...this.factories, factory];
        newBuilder.cache = this.cache;
        return newBuilder;
    }

    withCache(cache: Cache): ClientBuilder<TClient> {
        const newBuilder = new ClientBuilder<TClient>();
        newBuilder.factories = [...this.factories];
        newBuilder.cache = cache;
        return newBuilder;
    }

    build(): TClient & { cache: Cache } {
        let client = {} as TClient;
        
        // Use provided cache or default to NoOpCache
        const sharedCache = this.cache || new NoOpCache();
        
        const mergedAnalytics: AnalyticsProvider[] = [];
        
        for (const factory of this.factories) {
            const provider = factory(sharedCache);
            client = {
                ...client,
                ...provider
            };
            
            if (provider.analytics) {
                mergedAnalytics.push(...provider.analytics);
            }
        }
        
        // Add merged analytics if any were collected
        if (mergedAnalytics.length > 0) {
            (client as Record<string, unknown>)['analytics'] = mergedAnalytics;
        }
        
        // Add cache to complete the client
        const completeClient = {
            ...client,
            cache: sharedCache
        } as TClient & { cache: Cache };
        
        return completeClient;
    }
}