import type { Cache } from '../cache/cache.interface.js';
import { NoOpCache } from '../cache/noop-cache.js';
import type { Client } from './client.js';
import { MulticastAnalyticsProvider, type AnalyticsProvider } from '../providers/analytics.provider.js';
import {
  RequestContextSchema,
  type RequestContext,
} from '../schemas/session.schema.js';
import { MulticastProductRecommendationsProvider, type ProductRecommendationsProvider } from '../providers/product-recommendations.provider.js';

type CapabilityFactory<T> = (cache: Cache, context: RequestContext) => T;

type MergeCapabilities<Acc, New> = Omit<Acc, keyof New> & New;

export class ClientBuilder<TClient = Client> {
  private factories: Array<CapabilityFactory<Partial<Client>>> = [];
  private cache: Cache | undefined;
  private context: RequestContext;

  constructor(context: RequestContext) {
    this.context = context;
  }

  withCapability<TNew extends Partial<Client>>(
    factory: CapabilityFactory<TNew>
  ): ClientBuilder<MergeCapabilities<TClient, TNew>> {
    const newBuilder = new ClientBuilder<MergeCapabilities<TClient, TNew>>(this.context);
    newBuilder.factories = [...this.factories, factory];
    newBuilder.cache = this.cache;
    newBuilder.context = this.context;
    return newBuilder;
  }

  withCache(cache: Cache): ClientBuilder<TClient> {
    const newBuilder = new ClientBuilder<TClient>(this.context);
    newBuilder.factories = [...this.factories];
    newBuilder.cache = cache;
    newBuilder.context = this.context;
    return newBuilder;
  }

  build(): TClient & { cache: Cache } {
    let client = {} as TClient;

    // Default to no-op cache if none is provided
    const sharedCache = this.cache || new NoOpCache();
    const validatedContext = RequestContextSchema.safeParse(this.context);

    // Avoid returning the parsed result for context, to preserve object equality at the top level
    if (!validatedContext.success) {
      throw new Error('Invalid context: ' + validatedContext.error);
    }

    const mergedAnalytics: AnalyticsProvider[] = [];

    const mergedProductRecommendationsProviders: ProductRecommendationsProvider[] = [];

    for (const factory of this.factories) {
      const provider = factory(sharedCache, this.context);
      client = {
        ...client,
        ...provider,
      };

      if (provider.analytics) {
        mergedAnalytics.push(provider.analytics);
      }

      if (provider.productRecommendations) {
        mergedProductRecommendationsProviders.push(provider.productRecommendations);
      }
    }

    // Add cache to complete the client
    const completeClient = {
      ...client,
      analytics: new MulticastAnalyticsProvider(sharedCache, this.context, mergedAnalytics),
      productRecommendations: new MulticastProductRecommendationsProvider(sharedCache, this.context, mergedProductRecommendationsProviders),
      cache: sharedCache,
    } as TClient & { cache: Cache };

    return completeClient;
  }
}
