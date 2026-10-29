import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import {
  AnalyticsEventCartItemAddedSchema,
  AnalyticsEventMutationSchemas,
  AnalyticsEventSchema,
  AnalyticsMutationCartItemAddedSchema,
  AnalyticsMutationCartItemRemovedSchema,
  AnalyticsMutationCustomSchema,
  AnalyticsMutationOrderPlacedSchema,
  AnalyticsMutationProductClickedSchema,
  AnalyticsMutationSearchResultsViewedSchema,
  AnalyticsMutationUserLoggedInSchema,
  CartSchema,
  CostBreakDownSchema,
  OrderSchema,
  fromPDP,
  fromSearch,
} from '../index.js';
import type { AnalyticsEvent, AnalyticsEventType, SearchIdentifier } from '../index.js';

const cart = CartSchema.parse({
  identifier: { key: 'c1' },
  user: { userId: 'u1' },
  items: [{ identifier: { key: 'i1' }, product: { key: 'p1' }, variant: { sku: 's1' }, quantity: 2 }],
});

const search: SearchIdentifier = { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } };

const snapshot = { marketingIdentifier: { key: 'v1' }, identity: { type: 'Anonymous' }, locale: 'da-DK', currency: 'DKK' };

describe('analytics event schemas', () => {
  it('has one event schema per registered event type', () => {
    const registered = Object.keys(AnalyticsEventMutationSchemas).sort();
    const inUnion = AnalyticsEventSchema.options.map((option) => option.shape.type.value).sort();

    expect(inUnion).toEqual(registered);
    expect(registered).toHaveLength(38);
  });

  it('uses noun-verb kebab-case names', () => {
    for (const type of Object.keys(AnalyticsEventMutationSchemas)) {
      expect(type).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('accepts a cart-item-added helper payload with a nested origin', () => {
    const result = AnalyticsMutationCartItemAddedSchema.safeParse({
      cart,
      variant: { sku: 's1' },
      quantity: 1,
      origin: fromPDP(fromSearch(search, 4)),
      properties: { abVariant: 'b' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing carts and non-positive quantities', () => {
    expect(AnalyticsMutationCartItemAddedSchema.safeParse({ variant: { sku: 's1' }, quantity: 1 }).success).toBe(false);
    expect(AnalyticsMutationCartItemAddedSchema.safeParse({ cart, variant: { sku: 's1' }, quantity: 0 }).success).toBe(false);
  });

  it('accepts a removed line or just a sku', () => {
    const line = cart.items[0];

    expect(AnalyticsMutationCartItemRemovedSchema.safeParse({ cart, removed: line }).success).toBe(true);
    expect(AnalyticsMutationCartItemRemovedSchema.safeParse({ cart, removed: { sku: 's1' }, quantity: 1 }).success).toBe(true);
  });

  it('accepts products as identifiers and zero search results as an empty list', () => {
    expect(AnalyticsMutationProductClickedSchema.safeParse({ product: { key: 'p1' }, origin: fromSearch(search, 0) }).success).toBe(true);
    expect(AnalyticsMutationSearchResultsViewedSchema.safeParse({ search, products: [] }).success).toBe(true);
    expect(AnalyticsMutationProductClickedSchema.safeParse({ product: {} }).success).toBe(false);
  });

  it('treats previousMarketingId on user-logged-in as optional', () => {
    const identity = { type: 'Registered', id: { userId: 'u1' } };

    expect(AnalyticsMutationUserLoggedInSchema.safeParse({ identity }).success).toBe(true);
    expect(AnalyticsMutationUserLoggedInSchema.safeParse({ identity, previousMarketingId: { key: 'old' } }).success).toBe(true);
  });

  it('accepts a content-viewed payload with a list of concept ids', () => {
    const schema = AnalyticsEventMutationSchemas['content-viewed'];

    expect(schema.safeParse({ content: { key: 'a1', type: 'article' }, concepts: ['features/cordless'] }).success).toBe(true);
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: [] }).success).toBe(true);
    expect(schema.safeParse({ content: { key: 'a1' } }).success).toBe(false);
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: 'features/cordless' }).success).toBe(false);
    // at most 50 ids of at most 128 characters
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: Array.from({ length: 50 }, (_, i) => `features/c${i}`) }).success).toBe(true);
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: Array.from({ length: 51 }, (_, i) => `features/c${i}`) }).success).toBe(false);
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: [`features/${'x'.repeat(119)}`] }).success).toBe(true);
    expect(schema.safeParse({ content: { key: 'a1' }, concepts: [`features/${'x'.repeat(120)}`] }).success).toBe(false);
  });

  it('requires a name on custom events', () => {
    expect(AnalyticsMutationCustomSchema.safeParse({ name: 'x', payload: { a: 1 } }).success).toBe(true);
    expect(AnalyticsMutationCustomSchema.safeParse({ name: '', payload: {} }).success).toBe(false);
  });

  it('validates an order-placed payload', () => {
    const order = OrderSchema.parse({
      identifier: { key: 'o1' },
      userId: { userId: 'u1' },
      items: [],
      price: CostBreakDownSchema.parse({}),
      orderStatus: 'AwaitingPayment',
      inventoryStatus: 'NotAllocated',
      paymentInstructions: [],
    });

    expect(AnalyticsMutationOrderPlacedSchema.safeParse({ order }).success).toBe(true);
  });

  it('lets a project extend a mutation schema', () => {
    const ProjectCartItemAdded = AnalyticsMutationCartItemAddedSchema.extend({ giftWrap: z.boolean() });

    expect(ProjectCartItemAdded.safeParse({ cart, variant: { sku: 's1' }, quantity: 1, giftWrap: true }).success).toBe(true);
    expect(ProjectCartItemAdded.safeParse({ cart, variant: { sku: 's1' }, quantity: 1 }).success).toBe(false);
  });
});

describe('analytics event envelope union', () => {
  const envelope = { id: 'e1', occurredAt: new Date().toISOString(), context: snapshot };

  it('keeps origin and properties on the envelope and the rest in the payload', () => {
    const event = AnalyticsEventSchema.parse({
      ...envelope,
      type: 'cart-item-added',
      origin: fromSearch(search, 2),
      properties: { a: 1 },
      payload: { cart, variant: { sku: 's1' }, quantity: 1 },
    });

    expect(event.type).toBe('cart-item-added');
    expect(event.origin).toMatchObject({ type: 'search', position: 2 });
    expect(Object.keys(AnalyticsEventCartItemAddedSchema.shape.payload.shape)).not.toContain('origin');
  });

  it('narrows payload types by event type', () => {
    const event: AnalyticsEvent<'cart-item-added'> = AnalyticsEventCartItemAddedSchema.parse({
      ...envelope,
      type: 'cart-item-added',
      payload: { cart, variant: { sku: 's1' }, quantity: 3 },
    });
    const type: AnalyticsEventType = event.type;

    expect(type).toBe('cart-item-added');
    expect(event.payload.quantity).toBe(3);
  });

  it('rejects unknown types and payloads that do not match the type', () => {
    expect(AnalyticsEventSchema.safeParse({ ...envelope, type: 'cart-exploded', payload: {} }).success).toBe(false);
    expect(AnalyticsEventSchema.safeParse({ ...envelope, type: 'cart-item-added', payload: { quantity: 1 } }).success).toBe(false);
  });
});
