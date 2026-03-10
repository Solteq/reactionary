import type { Cache } from '../cache/cache.interface.js';
import { NoOpCache } from '../cache/noop-cache.js';
import type { Client } from './client.js';
import { MulticastAnalyticsCapability, type AnalyticsCapability } from '../capabilities/analytics.capability.js';
import {
  RequestContextSchema,
  type RequestContext,
} from '../schemas/session.schema.js';
import { MulticastProductRecommendationsCapability, type ProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';

export interface ClientBuilderFactoryArgs {
  cache: Cache;
  context: RequestContext;
}

export type CapabilityFactory<T> =
  | ((cache: Cache, context: RequestContext) => T)
  | ((args: ClientBuilderFactoryArgs) => T);

type MergeCapabilities<Acc, New> = Omit<Acc, keyof New> & New;
export type CapabilityCollisionStrategy = 'last-wins' | 'first-wins' | 'throw';

export class ClientBuilder<TClient = Client> {
  private factories: Array<CapabilityFactory<Partial<Client>>> = [];
  private cache: Cache | undefined;
  private context: RequestContext;
  private collisionStrategy: CapabilityCollisionStrategy = 'last-wins';

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
    newBuilder.collisionStrategy = this.collisionStrategy;
    return newBuilder;
  }

  withCache(cache: Cache): ClientBuilder<TClient> {
    const newBuilder = new ClientBuilder<TClient>(this.context);
    newBuilder.factories = [...this.factories];
    newBuilder.cache = cache;
    newBuilder.context = this.context;
    newBuilder.collisionStrategy = this.collisionStrategy;
    return newBuilder;
  }

  withCollisionStrategy(strategy: CapabilityCollisionStrategy): ClientBuilder<TClient> {
    const newBuilder = new ClientBuilder<TClient>(this.context);
    newBuilder.factories = [...this.factories];
    newBuilder.cache = this.cache;
    newBuilder.context = this.context;
    newBuilder.collisionStrategy = strategy;
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

    const mergedAnalytics: AnalyticsCapability[] = [];
    const mergedProductRecommendations: ProductRecommendationsCapability[] = [];

    for (const factory of this.factories) {
      const capability = this.resolveFactory(factory, sharedCache, this.context);
      client = this.mergeCapabilities(client, capability as Partial<TClient>);

      if (capability.analytics) {
        mergedAnalytics.push(capability.analytics);
      }

      if (capability.productRecommendations) {
        mergedProductRecommendations.push(capability.productRecommendations);
      }
    }

    // Add cache to complete the client
    const completeClient = {
      ...client,
      analytics: new MulticastAnalyticsCapability(sharedCache, this.context, mergedAnalytics),
      productRecommendations: new MulticastProductRecommendationsCapability(sharedCache, this.context, mergedProductRecommendations),
      cache: sharedCache,
    } as TClient & { cache: Cache };

    return completeClient;
  }

  private resolveFactory<TNew extends Partial<Client>>(
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
    target: TClient,
    source: Partial<TClient>,
  ): TClient {
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
    return result as TClient;
  }
}
