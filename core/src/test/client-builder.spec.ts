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
});
