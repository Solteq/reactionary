import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { createInitialRequestContext } from '../initialization.js';
import {
  AnalyticsConsentSchema,
  AnalyticsEventEnvelopeSchema,
  EventContextSnapshotSchema,
  OriginSchema,
  OriginSearchSchema,
  RequestContextSchema,
  fromAssociations,
  fromAutocomplete,
  fromCart,
  fromCategory,
  fromContent,
  fromDirect,
  fromList,
  fromOrder,
  fromPDP,
  fromProductList,
  fromPromotion,
  fromQuickOrder,
  fromSearch,
} from '../index.js';
import type { SearchIdentifier } from '../index.js';

const search: SearchIdentifier = {
  term: 'drill',
  facets: [],
  filters: [],
  paginationOptions: { pageNumber: 2, pageSize: 20 },
};

describe('analytics origins', () => {
  it('every constructor produces a value the schema accepts', () => {
    const origins = [
      fromSearch(search, 24),
      fromAutocomplete('dri', 0),
      fromCategory({ key: 'c1' }, [{ facet: { key: 'brand' }, key: 'bosch' }], 3),
      fromList({ key: 'r1', algorithm: 'trending' }, 'Trending now', 1),
      fromAssociations({ key: 'p1' }, 'cross-sell', 2),
      fromProductList({ listType: 'wish', key: 'w1' }, 0),
      fromPromotion({ key: 'promo1' }, 'hero'),
      fromContent('article-1'),
      fromCart('mini-cart'),
      fromOrder({ key: 'o1' }),
      fromQuickOrder('csv'),
      fromPDP(),
      fromDirect(),
    ];

    for (const origin of origins) {
      expect(OriginSchema.safeParse(origin).success, origin.type).toBe(true);
    }
  });

  it('keeps the nested origin of a PDP visit', () => {
    const origin = fromPDP(fromSearch(search, 4));
    const parsed = OriginSchema.parse(origin);

    expect(parsed).toMatchObject({
      type: 'pdp',
      upstream: { type: 'search', position: 4, identifier: { term: 'drill' } },
    });
  });

  it('nests PDP origins more than one level deep', () => {
    const parsed = OriginSchema.parse(fromPDP(fromPDP(fromDirect())));

    expect(parsed).toMatchObject({ type: 'pdp', upstream: { type: 'pdp', upstream: { type: 'direct' } } });
  });

  it('rejects invalid positions and unknown origin types', () => {
    expect(OriginSchema.safeParse(fromSearch(search, -1)).success).toBe(false);
    expect(OriginSchema.safeParse(fromSearch(search, 1.5)).success).toBe(false);
    expect(OriginSchema.safeParse({ type: 'somewhere-else' }).success).toBe(false);
    expect(OriginSchema.safeParse(fromPDP({ type: 'search', position: 0 } as never)).success).toBe(false);
  });

  it('lets a project extend a variant schema and keep vendor fields', () => {
    const ProjectSearchOrigin = OriginSearchSchema.extend({ queryId: z.string() });
    const parsed = ProjectSearchOrigin.parse({ ...fromSearch(search, 0), queryId: 'q-1' });

    expect(parsed.queryId).toBe('q-1');
  });
});

describe('analytics envelope and consent', () => {
  const snapshot = {
    marketingIdentifier: { key: 'visitor-1' },
    identity: { type: 'Anonymous' },
    locale: 'da-DK',
    currency: 'DKK',
  };

  it('accepts a snapshot without consent and with referrer page data', () => {
    expect(EventContextSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      EventContextSnapshotSchema.safeParse({ ...snapshot, consent: { analytics: true, marketing: false }, page: { url: '/p/1' } }).success,
    ).toBe(true);
  });

  it('validates the envelope fields', () => {
    const envelope = { id: crypto.randomUUID(), occurredAt: new Date().toISOString(), context: snapshot, origin: fromDirect() };

    expect(AnalyticsEventEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(AnalyticsEventEnvelopeSchema.safeParse({ ...envelope, occurredAt: 'yesterday' }).success).toBe(false);
  });

  it('requires both purposes in a consent object', () => {
    expect(AnalyticsConsentSchema.safeParse({ analytics: true }).success).toBe(false);
  });

  it('keeps request context parsing working with and without session consent', () => {
    const context = createInitialRequestContext();

    expect(RequestContextSchema.safeParse(context).success).toBe(true);
    expect(context.session.consent).toBeUndefined();

    context.session.consent = { analytics: false, marketing: false };
    const reparsed = RequestContextSchema.parse(JSON.parse(JSON.stringify(context)));

    expect(reparsed.session.consent).toEqual({ analytics: false, marketing: false });
  });
});
