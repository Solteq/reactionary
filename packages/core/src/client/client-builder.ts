import type { Cache } from '../cache/cache.interface.js';
import { NoOpCache } from '../cache/noop-cache.js';
import type { Client } from './client.js';
import { AnalyticsCapability } from '../capabilities/analytics.capability.js';
import type { AnalyticsProvider } from '../capabilities/analytics.provider.js';
import { createAnalyticsContext } from '../analytics/context.js';
import { AnalyticsDispatcher, type AnalyticsSubscriber } from '../analytics/dispatcher.js';
import type { AnalyticsDispatchOptions } from '../schemas/models/analytics/dispatch.model.js';
import {
  RequestContextSchema,
  type RequestContext,
} from '../schemas/session.schema.js';
import { MulticastProductRecommendationsCapability, type ProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';

export interface ClientBuilderFactoryArgs {
  cache: Cache;
  context: RequestContext;
}

/**
 * What capability factories return: the client's capabilities, except `analytics`, which is a vendor
 * {@link AnalyticsProvider} the builder registers as a subscriber. `client.analytics` itself is always built by the builder.
 */
export type ClientCapabilities = Omit<Partial<Client>, 'analytics'> & { analytics?: AnalyticsProvider };

export type CapabilityFactory<T> =
  | ((cache: Cache, context: RequestContext) => T)
  | ((args: ClientBuilderFactoryArgs) => T);

type MergeCapabilities<Acc, New> = Omit<Acc, keyof New | 'analytics'> & Omit<New, 'analytics'> & Pick<Acc, Extract<'analytics', keyof Acc>>;
export type CapabilityCollisionStrategy = 'last-wins' | 'first-wins' | 'throw';

export class ClientBuilder<TClient = Client> {
  private factories: Array<CapabilityFactory<ClientCapabilities>> = [];
  private cache: Cache | undefined;
  private context: RequestContext;
  private collisionStrategy: CapabilityCollisionStrategy = 'last-wins';
  private analyticsOptions: AnalyticsDispatchOptions = {};
  private analyticsSubscribers: AnalyticsSubscriber[] = [];

  constructor(context: RequestContext) {
    this.context = context;
  }

  withCapability<TNew extends ClientCapabilities>(
    factory: CapabilityFactory<TNew>
  ): ClientBuilder<MergeCapabilities<TClient, TNew>> {
    const newBuilder = this.clone<MergeCapabilities<TClient, TNew>>();
    newBuilder.factories = [...this.factories, factory];
    return newBuilder;
  }

  withCache(cache: Cache): ClientBuilder<TClient> {
    const newBuilder = this.clone();
    newBuilder.cache = cache;
    return newBuilder;
  }

  withCollisionStrategy(strategy: CapabilityCollisionStrategy): ClientBuilder<TClient> {
    const newBuilder = this.clone();
    newBuilder.collisionStrategy = strategy;
    return newBuilder;
  }

  /**
   * Configures how analytics events are delivered, e.g. `{ waitUntil: after }` in Next.js so vendor calls finish after the
   * response, or a `defaultConsent` for requests whose session carries no consent. Optional.
   */
  withAnalyticsDispatch(options: AnalyticsDispatchOptions): ClientBuilder<TClient> {
    const newBuilder = this.clone();
    newBuilder.analyticsOptions = { ...this.analyticsOptions, ...options };
    return newBuilder;
  }

  /**
   * Adds a custom analytics subscriber next to the providers registered by capability factories. Subscriptions are
   * fixed at build time; there is no way to subscribe at runtime.
   */
  withAnalyticsSubscriber(subscriber: AnalyticsSubscriber): ClientBuilder<TClient> {
    const newBuilder = this.clone();
    newBuilder.analyticsSubscribers = [...this.analyticsSubscribers, subscriber];
    return newBuilder;
  }

  build(): TClient & { cache: Cache } {
    let client: ClientCapabilities = {};

    // Default to no-op cache if none is provided
    const sharedCache = this.cache || new NoOpCache();
    const validatedContext = RequestContextSchema.safeParse(this.context);

    // Avoid returning the parsed result for context, to preserve object equality at the top level
    if (!validatedContext.success) {
      throw new Error('Invalid context: ' + validatedContext.error);
    }

    const analyticsProviders: AnalyticsProvider[] = [];
    const mergedProductRecommendations: ProductRecommendationsCapability[] = [];

    for (const factory of this.factories) {
      const capability = this.resolveFactory(factory, sharedCache, this.context);
      client = this.mergeCapabilities(client, capability);

      if (capability.analytics) {
        analyticsProviders.push(capability.analytics);
      }

      if (capability.productRecommendations) {
        mergedProductRecommendations.push(capability.productRecommendations);
      }
    }

    const dispatcher = new AnalyticsDispatcher({
      requestContext: this.context,
      subscribers: [...analyticsProviders, ...this.analyticsSubscribers],
      // Lookups use the client's own capabilities (and so its cache); `client` is complete by the time anything is flushed.
      createContext: () => createAnalyticsContext({ capabilities: client, requestContext: this.context }),
      options: this.analyticsOptions,
    });

    // Add cache to complete the client
    const completeClient = {
      ...client,
      analytics: new AnalyticsCapability(sharedCache, this.context, dispatcher),
      productRecommendations: new MulticastProductRecommendationsCapability(sharedCache, this.context, mergedProductRecommendations),
      cache: sharedCache,
    };

    // TClient only exists at the type level, accumulated by withCapability, so the compiler cannot verify it against the merged object.
    return completeClient as unknown as TClient & { cache: Cache };
  }

  private clone<TNext = TClient>(): ClientBuilder<TNext> {
    const newBuilder = new ClientBuilder<TNext>(this.context);
    newBuilder.factories = [...this.factories];
    newBuilder.cache = this.cache;
    newBuilder.collisionStrategy = this.collisionStrategy;
    newBuilder.analyticsOptions = this.analyticsOptions;
    newBuilder.analyticsSubscribers = [...this.analyticsSubscribers];
    return newBuilder;
  }

  private resolveFactory<TNew extends ClientCapabilities>(
    factory: CapabilityFactory<TNew>,
    cache: Cache,
    context: RequestContext,
  ): TNew {
    if (factory.length <= 1) {
      return (factory as (args: ClientBuilderFactoryArgs) => TNew)({ cache, context });
    }
    return (factory as (cache: Cache, context: RequestContext) => TNew)(cache, context);
  }

  private mergeCapabilities(
    target: ClientCapabilities,
    source: ClientCapabilities,
  ): ClientCapabilities {
    const result = { ...target } as Record<string, unknown>;
    for (const key of Object.keys(source as object)) {
      const hasExisting = Object.prototype.hasOwnProperty.call(result, key);
      if (hasExisting) {
        if (this.collisionStrategy === 'first-wins') {
          continue;
        }
        if (this.collisionStrategy === 'throw') {
          throw new Error(`Capability collision detected for "${key}"`);
        }
      }
      result[key] = (source as Record<string, unknown>)[key];
    }
    return result as ClientCapabilities;
  }
}
