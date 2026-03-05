import { describe, expect, it } from "vitest";
import type { Capabilities, ClientFromCapabilities } from "../schemas/capabilities.schema.js";
import type { Cache } from '../cache/cache.interface.js';
import type { RequestContext } from "../schemas/session.schema.js";
import { AnalyticsProvider } from "../providers/analytics.provider.js";
import type { AnalyticsMutation } from "../schemas/index.js";
import { NoOpCache } from "../cache/noop-cache.js";
import { createInitialRequestContext } from "../initialization.js";
import { ClientBuilder } from "../client/client-builder.js";
import type { Client } from "../client/client.js";
import { ProductProvider } from "../providers/product.provider.js";

export class MockAnalyticsProvider extends AnalyticsProvider {
    public events: Array<AnalyticsMutation> = [];

    public override async track(event: AnalyticsMutation): Promise<void> {
        this.events.push(event);
    }
}

export interface MockConfiguration {
    mock?: string;
}

export function withMockCapabilities<T extends Partial<Capabilities>>(
  client: Partial<Client>
) {
  return (
    cache: Cache,
    context: RequestContext
  ): ClientFromCapabilities<T> => {
    return client as ClientFromCapabilities<T>
  }
};

describe('Client Builder', () => {
  it('should properly multicast analytics events to all analytics providers that register themselves', async () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);
    const analyticsProvider = new MockAnalyticsProvider(cache, context);
    const secondaryAnalyticsProvider = new MockAnalyticsProvider(cache, context);
    const client = builder
        .withCache(cache)
        .withCapability(withMockCapabilities({ analytics: analyticsProvider }))
        .withCapability(withMockCapabilities({ analytics: secondaryAnalyticsProvider }))
        .build();

    const track = await client.analytics.track({
        event: 'product-details-view',
        product: {
          key: 'P-1000'
        }
    });

    expect(analyticsProvider.events.length).toBe(1);
    expect(analyticsProvider.events[0].event).toBe('product-details-view');
    expect(secondaryAnalyticsProvider.events.length).toBe(1);
    expect(secondaryAnalyticsProvider.events[0].event).toBe('product-details-view');
  });

  it('supports capability factories with args object signature', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);
    const analyticsProvider = new MockAnalyticsProvider(cache, context);

    const client = builder
      .withCache(cache)
      .withCapability(({ cache: sharedCache, context: sharedContext }) => {
        expect(sharedCache).toBe(cache);
        expect(sharedContext).toBe(context);
        return { analytics: analyticsProvider };
      })
      .build();

    expect(client.analytics).toBeDefined();
  });

  it('supports throw collision strategy', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);

    class TestProductProvider extends ProductProvider {
      public override async getById(): Promise<any> {
        throw new Error('not implemented');
      }
      public override async getBySlug(): Promise<any> {
        throw new Error('not implemented');
      }
      public override async getBySKU(): Promise<any> {
        throw new Error('not implemented');
      }
    }

    expect(() =>
      builder
        .withCache(cache)
        .withCollisionStrategy('throw')
        .withCapability(() => ({ product: new TestProductProvider(cache, context) }))
        .withCapability(() => ({ product: new TestProductProvider(cache, context) }))
        .build(),
    ).toThrow(/Capability collision detected for "product"/);
  });

  it('supports first-wins collision strategy', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);

    class TestProductProvider extends ProductProvider {
      public name: string;
      constructor(cache: Cache, context: RequestContext, name: string) {
        super(cache, context);
        this.name = name;
      }
      public override async getById(): Promise<any> {
        throw new Error('not implemented');
      }
      public override async getBySlug(): Promise<any> {
        throw new Error('not implemented');
      }
      public override async getBySKU(): Promise<any> {
        throw new Error('not implemented');
      }
    }

    const first = new TestProductProvider(cache, context, 'first');
    const second = new TestProductProvider(cache, context, 'second');

    const client = builder
      .withCache(cache)
      .withCollisionStrategy('first-wins')
      .withCapability(() => ({ product: first }))
      .withCapability(() => ({ product: second }))
      .build();

    expect((client.product as TestProductProvider).name).toBe('first');
  });
});
