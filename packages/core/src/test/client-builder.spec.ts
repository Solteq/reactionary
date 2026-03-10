import { describe, expect, it } from "vitest";
import type { Capabilities, ClientFromCapabilities } from "../schemas/capabilities.schema.js";
import type { Cache } from '../cache/cache.interface.js';
import type { RequestContext } from "../schemas/session.schema.js";
import { AnalyticsCapability } from "../capabilities/analytics.capability.js";
import type { AnalyticsMutation } from "../schemas/index.js";
import { NoOpCache } from "../cache/noop-cache.js";
import { createInitialRequestContext } from "../initialization.js";
import { ClientBuilder } from "../client/client-builder.js";
import type { Client } from "../client/client.js";
import { ProductCapability } from "../capabilities/product.capability.js";

export class MockAnalyticsCapability extends AnalyticsCapability {
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
    const analyticsCapability = new MockAnalyticsCapability(cache, context);
    const secondaryAnalyticsCapability = new MockAnalyticsCapability(cache, context);
    const client = builder
        .withCache(cache)
        .withCapability(withMockCapabilities({ analytics: analyticsCapability }))
        .withCapability(withMockCapabilities({ analytics: secondaryAnalyticsCapability }))
        .build();

    const track = await client.analytics.track({
        event: 'product-details-view',
        product: {
          key: 'P-1000'
        }
    });

    expect(analyticsCapability.events.length).toBe(1);
    expect(analyticsCapability.events[0].event).toBe('product-details-view');
    expect(secondaryAnalyticsCapability.events.length).toBe(1);
    expect(secondaryAnalyticsCapability.events[0].event).toBe('product-details-view');
  });

  it('supports capability factories with args object signature', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);
    const analyticsCapability = new MockAnalyticsCapability(cache, context);

    const client = builder
      .withCache(cache)
      .withCapability(({ cache: sharedCache, context: sharedContext }) => {
        expect(sharedCache).toBe(cache);
        expect(sharedContext).toBe(context);
        return { analytics: analyticsCapability };
      })
      .build();

    expect(client.analytics).toBeDefined();
  });

  it('supports throw collision strategy', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);

    class TestProductCapability extends ProductCapability {
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
        .withCapability(() => ({ product: new TestProductCapability(cache, context) }))
        .withCapability(() => ({ product: new TestProductCapability(cache, context) }))
        .build(),
    ).toThrow(/Capability collision detected for "product"/);
  });

  it('supports first-wins collision strategy', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);

    class TestProductCapability extends ProductCapability {
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

    const first = new TestProductCapability(cache, context, 'first');
    const second = new TestProductCapability(cache, context, 'second');

    const client = builder
      .withCache(cache)
      .withCollisionStrategy('first-wins')
      .withCapability(() => ({ product: first }))
      .withCapability(() => ({ product: second }))
      .build();

    expect((client.product as TestProductCapability).name).toBe('first');
  });
});
