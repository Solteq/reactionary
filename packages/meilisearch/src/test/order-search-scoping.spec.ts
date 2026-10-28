import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn<(term: string, params: { filter?: unknown }) => Promise<unknown>>(),
  index: vi.fn(),
}));

vi.mock('meilisearch', () => ({
  Meilisearch: class {
    public index(name: string) {
      mocks.index(name);
      return { search: mocks.search };
    }
  },
}));

import {
  NoOpCache,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { IdentityIdentifier, OrderSearchQueryByTerm, RequestContext } from '@reactionary/core';
import { MeilisearchOrderSearchCapability } from '../capabilities/order-search.capability.js';
import { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

class TestableOrderSearchCapability extends MeilisearchOrderSearchCapability {
  public buildSearchParams(payload: OrderSearchQueryByTerm, scopedUserIds: string[]) {
    return this.queryByTermPayload(payload, scopedUserIds);
  }
}

/** A project that lets a buyer search the orders of the colleagues they manage. */
class ManagerOrderSearchCapability extends TestableOrderSearchCapability {
  protected override async resolveScopedUserIds(payload: OrderSearchQueryByTerm): Promise<string[] | undefined> {
    const colleagues = await Promise.resolve(['colleague-1', 'colleague-2']);
    const requested = payload.search.user?.userId;
    return requested !== undefined && colleagues.includes(requested)
      ? colleagues
      : super.resolveScopedUserIds(payload);
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const createContext = (identity?: { type: 'Registered' | 'Guest'; userId: string }): RequestContext => {
  const context = createInitialRequestContext();
  if (identity) {
    context.session.identityContext.identity = { type: identity.type, id: { userId: identity.userId } };
  }
  return context;
};

const createCapability = (
  context: RequestContext,
  type: typeof TestableOrderSearchCapability = TestableOrderSearchCapability,
) =>
  new type(
    config,
    new NoOpCache(),
    context,
    new MeilisearchOrderSearchFactory(OrderSearchResultSchema),
  );

const createPayload = (search: Partial<OrderSearchQueryByTerm['search']>): OrderSearchQueryByTerm =>
  OrderSearchQueryByTermSchema.parse({
    search: {
      term: '',
      filters: [],
      paginationOptions: { pageNumber: 1, pageSize: 20 },
      ...search,
    },
  });

const hit = {
  orderIdentifier: 'order-1',
  userIdentifier: 'alice',
  customerName: 'Alice',
  shippingAddress: { address1: 'Street', address2: '1', city: 'Aarhus', postalCode: '8000', country: 'DK' },
  orderDate: '2025-01-01',
  orderDateTimestamp: 1735689600000,
  orderStatus: 'shipped',
  inventoryStatus: 'allocated',
  totalAmount: 100,
  currency: 'DKK',
};

const alice: IdentityIdentifier = { userId: 'alice' };
const bob: IdentityIdentifier = { userId: 'bob' };

describe('MeilisearchOrderSearchCapability scoping', () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.index.mockReset();
    mocks.search.mockResolvedValue({ hits: [hit], offset: 0, limit: 20, estimatedTotalHits: 1 });
  });

  describe('filter', () => {
    it('matches nothing when there are no users to scope to', () => {
      const capability = createCapability(createContext());
      expect(capability.buildSearchParams(createPayload({ user: bob }), []).filter).toBe(
        '(userIdentifier = "" AND userIdentifier != "")',
      );
    });

    it('groups several users', () => {
      const capability = createCapability(createContext());
      expect(capability.buildSearchParams(createPayload({}), ['a', 'b']).filter).toBe(
        '(userIdentifier = "a" OR userIdentifier = "b")',
      );
    });

    it('applies the supplied filters inside parentheses, after the user restriction', () => {
      const capability = createCapability(createContext());
      const params = capability.buildSearchParams(
        createPayload({ filters: ['totalAmount > 10 OR currency = "DKK"'] }),
        ['alice'],
      );
      expect(params.filter).toBe('userIdentifier = "alice" AND (totalAmount > 10 OR currency = "DKK")');
    });

    it.each([
      ['closes the group it is wrapped in', '1) OR (userIdentifier != "alice"'],
      ['closes a group it never opened', 'a = 1)'],
      ['leaves a group open', '(a = 1'],
      ['leaves a quote open', 'a = "x) OR (userIdentifier != \\"alice'],
    ])('matches nothing when a supplied filter %s', (_name, filter) => {
      const capability = createCapability(createContext());
      expect(capability.buildSearchParams(createPayload({ filters: [filter] }), ['alice']).filter).toBe(
        '(userIdentifier = "" AND userIdentifier != "")',
      );
    });

    it('accepts parentheses inside quoted values and balanced groups', () => {
      const capability = createCapability(createContext());
      const params = capability.buildSearchParams(
        createPayload({ filters: ['customerName = "a) OR (b"', '(a = 1 OR b = 2) AND c = 3'] }),
        ['alice'],
      );
      expect(params.filter).toBe(
        'userIdentifier = "alice" AND (customerName = "a) OR (b") AND ((a = 1 OR b = 2) AND c = 3)',
      );
    });
  });

  describe('queryByTerm', () => {
    it('searches the signed-in user\'s orders when the same user is given', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: 'alice' }));
      await capability.queryByTerm(createPayload({ user: alice }));

      expect(mocks.search.mock.calls[0][1].filter).toBe('userIdentifier = "alice"');
    });

    it('searches the signed-in user\'s orders when no user is given', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: 'alice' }));
      const result = await capability.queryByTerm(createPayload({}));

      expect(mocks.search).toHaveBeenCalledTimes(1);
      expect(mocks.search.mock.calls[0][1].filter).toBe('userIdentifier = "alice"');
      expect(result.success && result.value.items).toHaveLength(1);
    });

    it('does not search at all, and returns nothing, when another user is requested', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: 'alice' }));
      const result = await capability.queryByTerm(createPayload({ user: bob }));

      expect(mocks.search).not.toHaveBeenCalled();
      expect(result.success && result.value.items).toEqual([]);
      expect(result.success && result.value.totalCount).toBe(0);
    });

    it('does not search at all when nobody is signed in', async () => {
      const capability = createCapability(createContext());
      const result = await capability.queryByTerm(createPayload({}));

      expect(mocks.search).not.toHaveBeenCalled();
      expect(result.success && result.value.items).toEqual([]);
    });

    it('does not search at all for a guest', async () => {
      const capability = createCapability(createContext({ type: 'Guest', userId: 'guest-1' }));
      const result = await capability.queryByTerm(createPayload({ user: { userId: 'guest-1' } }));

      expect(mocks.search).not.toHaveBeenCalled();
      expect(result.success && result.value.items).toEqual([]);
    });

    it('does not search at all for a registered identity without a user id', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: '' }));
      await capability.queryByTerm(createPayload({}));

      expect(mocks.search).not.toHaveBeenCalled();
    });

    it('does not search at all when a supplied filter tries to leave its parentheses', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: 'alice' }));
      const result = await capability.queryByTerm(createPayload({ filters: ['1) OR (userIdentifier != "alice"'] }));

      expect(mocks.search).not.toHaveBeenCalled();
      expect(result.success && result.value.items).toEqual([]);
    });

    it('passes a well-formed supplied filter next to the user restriction', async () => {
      const capability = createCapability(createContext({ type: 'Registered', userId: 'alice' }));
      await capability.queryByTerm(createPayload({ filters: ['totalAmount > 10 OR currency = "DKK"'] }));

      expect(mocks.search.mock.calls[0][1].filter).toBe(
        'userIdentifier = "alice" AND (totalAmount > 10 OR currency = "DKK")',
      );
    });

    it('lets a subclass widen the scope through resolveScopedUserIds', async () => {
      const capability = createCapability(
        createContext({ type: 'Registered', userId: 'manager' }),
        ManagerOrderSearchCapability,
      );
      await capability.queryByTerm(createPayload({ user: { userId: 'colleague-1' } }));
      expect(mocks.search.mock.calls[0][1].filter).toBe(
        '(userIdentifier = "colleague-1" OR userIdentifier = "colleague-2")',
      );

      mocks.search.mockClear();
      await capability.queryByTerm(createPayload({ user: bob }));
      expect(mocks.search).not.toHaveBeenCalled();
    });
  });
});
