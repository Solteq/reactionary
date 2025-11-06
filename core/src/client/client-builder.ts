import type { Cache } from '../cache/cache.interface.js';
import { NoOpCache } from '../cache/noop-cache.js';
import type { Client } from './client.js';
import type { AnalyticsProvider } from '../providers/analytics.provider.js';
import {
  RequestContextSchema,
  type RequestContext,
} from '../schemas/session.schema.js';

type CapabilityFactory<T> = (cache: Cache, context: RequestContext) => T;

type MergeCapabilities<Acc, New> = Omit<Acc, keyof New> & New;

export class ClientBuilder<TClient = object> {
  private factories: Array<CapabilityFactory<Partial<Client>>> = [];
  private cache: Cache | undefined;
  private context: RequestContext | undefined;

  withCapability<TNew extends Partial<Client>>(
    factory: CapabilityFactory<TNew>
  ): ClientBuilder<MergeCapabilities<TClient, TNew>> {
    const newBuilder = new ClientBuilder<MergeCapabilities<TClient, TNew>>();
    newBuilder.factories = [...this.factories, factory];
    newBuilder.cache = this.cache;
    newBuilder.context = this.context;
    return newBuilder;
  }

  withCache(cache: Cache): ClientBuilder<TClient> {
    const newBuilder = new ClientBuilder<TClient>();
    newBuilder.factories = [...this.factories];
    newBuilder.cache = cache;
    newBuilder.context = this.context;
    return newBuilder;
  }

  withContext(context: RequestContext): ClientBuilder<TClient> {
    const newBuilder = new ClientBuilder<TClient>();
    newBuilder.factories = [...this.factories];
    newBuilder.cache = this.cache;
    newBuilder.context = context;
    return newBuilder;
  }

  build(): TClient & { cache: Cache } {
    let client = {} as TClient;

    // Use provided cache or default to NoOpCache
    const sharedCache = this.cache || new NoOpCache();
    const context =
      this.context ||
      RequestContextSchema.parse({
        languageContext: {
          locale: 'en-US',
          currencyCode: 'USD',
          countryCode: 'US',
        },
      });

    const mergedAnalytics: AnalyticsProvider[] = [];

    for (const factory of this.factories) {
      const provider = factory(sharedCache, context);
      client = {
        ...client,
        ...provider,
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
      cache: sharedCache,
    } as TClient & { cache: Cache };

    return completeClient;
  }
}
