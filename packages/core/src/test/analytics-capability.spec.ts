import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoOpCache } from '../cache/noop-cache.js';
import { ClientBuilder } from '../client/client-builder.js';
import { createInitialRequestContext } from '../initialization.js';
import {
  AnalyticsCapability,
  AnalyticsEventMutationSchemas,
  CartSchema,
  ProductCapability,
  RecordingAnalyticsSubscriber,
  error,
  fromPDP,
  fromSearch,
  success,
} from '../index.js';
import type { AnalyticsSubscriber, Product, Result, SearchIdentifier } from '../index.js';

const cart = CartSchema.parse({
  identifier: { key: 'c1' },
  user: { userId: 'u1' },
  items: [{ identifier: { key: 'i1' }, product: { key: 'p1' }, variant: { sku: 's1' }, quantity: 2 }],
});
const search: SearchIdentifier = { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };

function builder() {
  return new ClientBuilder(createInitialRequestContext()).withCache(new NoOpCache());
}

class StubProductCapability extends ProductCapability {
  public lookups: string[] = [];
  public override async getById(payload: { identifier: { key: string } }): Promise<Result<Product>> {
    this.lookups.push(payload.identifier.key);
    return success({ identifier: payload.identifier, name: `Product ${payload.identifier.key}` } as unknown as Product);
  }
  public override async getBySlug(): Promise<never> {
    throw new Error('not implemented');
  }
  public override async getBySKU(): Promise<Result<Product>> {
    return error({ type: 'NotFound', identifier: 'x' });
  }
}

describe('client.analytics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is the storefront-facing capability, built by the builder even without providers', () => {
    const client = builder().build();

    expect(client.analytics).toBeInstanceOf(AnalyticsCapability);
  });

  it('has one helper per event type, named after the event in camelCase', () => {
    const client = builder().build();
    const toCamel = (type: string) => type.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

    for (const type of Object.keys(AnalyticsEventMutationSchemas)) {
      expect(typeof (client.analytics as unknown as Record<string, unknown>)[toCamel(type)], type).toBe('function');
    }
  });

  it('enqueues from a helper, returns the event id and delivers to subscribers on flush', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const client = builder().withAnalyticsSubscriber(recorder).build();

    const result = await client.analytics.cartItemAdded({
      cart,
      variant: { sku: 's1' },
      quantity: 1,
      origin: fromPDP(fromSearch(search, 4)),
      properties: { abVariant: 'b' },
    });
    await client.analytics.flush();

    expect(result.success && result.value.eventId).toBe(recorder.events[0].id);
    expect(recorder.events[0]).toMatchObject({
      type: 'cart-item-added',
      payload: { variant: { sku: 's1' }, quantity: 1 },
      origin: { type: 'pdp', upstream: { type: 'search', position: 4 } },
      properties: { abVariant: 'b' },
    });
  });

  it('returns an error result for invalid input instead of throwing, and delivers nothing', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const client = builder().withAnalyticsSubscriber(recorder).build();

    // @ts-expect-error cart is required
    const result = await client.analytics.cartItemAdded({ variant: { sku: 's1' }, quantity: 1 });
    await client.analytics.flush();

    expect(result.success).toBe(false);
    expect(recorder.events).toHaveLength(0);
  });

  it('supports custom events', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const client = builder().withAnalyticsSubscriber(recorder).build();

    await client.analytics.custom({ name: 'size-guide-opened', payload: { sku: 's1' } });
    await client.analytics.flush();

    expect(recorder.events[0]).toMatchObject({ type: 'custom', payload: { name: 'size-guide-opened', payload: { sku: 's1' } } });
  });

  it('keeps one dispatcher per built client', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const base = builder().withAnalyticsSubscriber(recorder);
    const first = base.build();
    const second = base.build();

    await first.analytics.productViewed({ product: { key: 'p1' } });
    await first.analytics.flush();
    await second.analytics.flush();

    expect(recorder.events).toHaveLength(1);
    expect(first.analytics).not.toBe(second.analytics);
  });

  it('hands vendor delivery to waitUntil', async () => {
    const recorder = new RecordingAnalyticsSubscriber();
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const client = builder().withAnalyticsSubscriber(recorder).withAnalyticsDispatch({ waitUntil }).build();

    await client.analytics.productViewed({ product: { key: 'p1' } });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(recorder.events).toHaveLength(1);
  });

  it('applies the configured default consent when the session carries none', async () => {
    const analyticsSubscriber: AnalyticsSubscriber = new RecordingAnalyticsSubscriber('analytics-only', ['*'], 'analytics');
    const necessary = new RecordingAnalyticsSubscriber('necessary', ['*'], 'necessary');
    const client = builder()
      .withAnalyticsSubscriber(analyticsSubscriber)
      .withAnalyticsSubscriber(necessary)
      .withAnalyticsDispatch({ defaultConsent: { analytics: false, marketing: false } })
      .build();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(necessary.events).toHaveLength(1);
    expect((analyticsSubscriber as RecordingAnalyticsSubscriber).events).toHaveLength(0);
  });

  it('keeps builder methods immutable', () => {
    const base = builder();
    const withSubscriber = base.withAnalyticsSubscriber(new RecordingAnalyticsSubscriber());
    const withOptions = withSubscriber.withAnalyticsDispatch({ defaultConsent: { analytics: false, marketing: false } });

    expect(withSubscriber).not.toBe(base);
    expect(withOptions).not.toBe(withSubscriber);
  });

  it('gives subscribers lookups bound to the client\'s own capabilities', async () => {
    const product = new StubProductCapability(new NoOpCache(), createInitialRequestContext());
    let name: string | undefined;
    const subscriber: AnalyticsSubscriber = {
      name: 'enriching',
      types: ['product-viewed'],
      purpose: 'necessary',
      async handle(event, ctx) {
        if (event.type !== 'product-viewed' || !('key' in event.payload.product)) return;
        const lookup = await ctx.products.byId({ key: event.payload.product.key });
        name = lookup.success ? lookup.value.name : undefined;
      },
    };
    const client = builder().withCapability(() => ({ product })).withAnalyticsSubscriber(subscriber).build();

    await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(name).toBe('Product p1');
    expect(product.lookups).toEqual(['p1']);
  });

  it('rejects two subscribers with the same name at build time', () => {
    expect(() =>
      builder()
        .withAnalyticsSubscriber(new RecordingAnalyticsSubscriber('same'))
        .withAnalyticsSubscriber(new RecordingAnalyticsSubscriber('same'))
        .build(),
    ).toThrow(/Duplicate/);
  });
});
