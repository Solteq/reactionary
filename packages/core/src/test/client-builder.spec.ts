import { describe, expect, it } from "vitest";
import type { Capabilities, ClientFromCapabilities } from "../schemas/capabilities.schema.js";
import type { Cache } from '../cache/cache.interface.js';
import type { RequestContext } from "../schemas/session.schema.js";
import { AnalyticsProvider } from "../capabilities/analytics.provider.js";
import type { AnalyticsEvent } from "../schemas/index.js";
import { NoOpCache } from "../cache/noop-cache.js";
import { createInitialRequestContext } from "../initialization.js";
import { ClientBuilder, type ClientBuilderFactoryArgs, type ClientCapabilities } from "../client/client-builder.js";
import { ProductCapability } from "../capabilities/product.capability.js";

abstract class MockAnalyticsProvider extends AnalyticsProvider {
    public readonly types = ['*'] as const;
    public readonly purpose = 'necessary' as const;
    public events: Array<AnalyticsEvent> = [];

    public override async handle(event: AnalyticsEvent) {
        this.events.push(event);
        return 'accepted' as const;
    }
}

export class MockPrimaryAnalyticsCapability extends MockAnalyticsProvider {
    protected override getResourceName(): string {
        return 'primary';
    }
}

export class MockSecondaryAnalyticsCapability extends MockAnalyticsProvider {
    protected override getResourceName(): string {
        return 'secondary';
    }
}

export interface MockConfiguration {
    mock?: string;
}

export function withMockCapabilities<T extends Partial<Capabilities>>(
  client: ClientCapabilities
) {
  return (
    cache: Cache,
    context: RequestContext
  ): ClientFromCapabilities<T> => {
    return client as ClientFromCapabilities<T>
  }
};

describe('Client Builder', () => {
  it('registers analytics providers from capability factories as subscribers and delivers helper events to all of them', async () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);
    const analyticsCapability = new MockPrimaryAnalyticsCapability(cache, context);
    const secondaryAnalyticsCapability = new MockSecondaryAnalyticsCapability(cache, context);
    const client = builder
        .withCache(cache)
        .withCapability(withMockCapabilities({ analytics: analyticsCapability }))
        .withCapability(withMockCapabilities({ analytics: secondaryAnalyticsCapability }))
        .build();

    const result = await client.analytics.productViewed({
        product: {
          key: 'P-1000'
        }
    });
    await client.analytics.flush();

    expect(result.success).toBe(true);
    expect(analyticsCapability.events.length).toBe(1);
    expect(analyticsCapability.events[0].type).toBe('product-viewed');
    expect(secondaryAnalyticsCapability.events.length).toBe(1);
    expect(secondaryAnalyticsCapability.events[0].type).toBe('product-viewed');
  });

  it('supports capability factories with args object signature', () => {
    const cache = new NoOpCache();
    const context = createInitialRequestContext();
    const builder = new ClientBuilder(context);
    const analyticsCapability = new MockPrimaryAnalyticsCapability(cache, context);

    const client = builder
      .withCache(cache)
      .withCapability(({ cache: capabilityCache, context: capabilityContext }: ClientBuilderFactoryArgs) => {
        expect(capabilityCache).toBe(cache);
        expect(capabilityContext).toBe(context);
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
