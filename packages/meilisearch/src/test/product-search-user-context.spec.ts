import { describe, expect, it } from 'vitest';
import { NoOpCache, ProductSearchQueryByTermSchema, ProductSearchResultSchema, createInitialRequestContext } from '@reactionary/core';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

type Profile = { blurb?: string; segments?: string[]; affinities?: Record<string, number> };

class TestableProductSearchCapability extends MeilisearchProductSearchCapability {
  public userContext(profile: Profile | undefined) {
    return this.userContextOf(profile && { blurb: '', segments: [], affinities: {}, ...profile });
  }

  /** What a search with this profile sends. */
  public searchParams(profile: Profile) {
    return this.queryByTermPayload(
      ProductSearchQueryByTermSchema.parse({
        search: { term: '', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } },
        personalizationProfile: { identifier: { key: 'visitor-1' }, blurb: '', segments: [], affinities: {}, ...profile },
      }),
    );
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const create = (type: typeof TestableProductSearchCapability = TestableProductSearchCapability) =>
  new type(config, new NoOpCache(), createInitialRequestContext(), new MeilisearchProductSearchFactory(ProductSearchResultSchema));

const userContext = (profile: Profile | undefined) => create().userContext(profile);

describe('MeilisearchProductSearchCapability user context', () => {
  it('has nothing to say without a profile or of an empty one', () => {
    expect(userContext(undefined)).toBeUndefined();
    expect(userContext({})).toBeUndefined();
  });

  it('says the segments alphabetically', () => {
    expect(userContext({ segments: ['vip', 'lapsed', 'campaign'] })).toBe('The customer is in the following segments: campaign, lapsed, vip');
  });

  it('says the strong interests in words, then the other segments', () => {
    expect(userContext({ segments: ['vip', 'lapsed'], affinities: { 'features/cordless': 1, 'application/power-tools': 1 } })).toBe(
      'Strong interest in: power tools, cordless. The customer is in the following segments: lapsed, vip',
    );
  });

  it('leaves the medium and the low interests out', () => {
    expect(userContext({ affinities: { 'features/cordless': 1, 'application/drilling-fastening': 0.6, 'trade/carpenter': 0.3 } })).toBe(
      'Strong interest in: cordless',
    );
    expect(userContext({ affinities: { 'application/drilling-fastening': 0.6, 'trade/carpenter': 0.3 } })).toBeUndefined();
  });

  it('leaves the affinity segments out of the segments', () => {
    expect(
      userContext({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.trade.carpenter.low'], affinities: { 'features/cordless': 1 } }),
    ).toBe('Strong interest in: cordless. The customer is in the following segments: vip');
    expect(userContext({ segments: ['affinity.trade.carpenter.low'], affinities: { 'trade/carpenter': 0.3 } })).toBeUndefined();
  });

  it('gives the same text whatever order the interests and segments come in', () => {
    expect(userContext({ segments: ['b', 'a'], affinities: { 'features/y': 1, 'features/x': 1 } })).toBe(
      userContext({ segments: ['a', 'b'], affinities: { 'features/x': 1, 'features/y': 1 } }),
    );
  });

  it('names at most five strong interests, by concept id, and a name once', () => {
    const affinities = Object.fromEntries(['g', 'f', 'e', 'd', 'c', 'b', 'a'].map((slug) => [`features/${slug}`, 1]));
    expect(userContext({ affinities })).toBe('Strong interest in: a, b, c, d, e');
    expect(userContext({ affinities: { 'application/power-tools': 1, 'features/power_tools': 1 } })).toBe('Strong interest in: power tools');
  });

  it('puts the blurb first', () => {
    expect(userContext({ blurb: 'Likes drills', segments: ['vip'], affinities: { 'features/cordless': 1 } })).toBe(
      'Likes drills. Strong interest in: cordless. The customer is in the following segments: vip',
    );
  });

  it('cuts the text where it is too long, the segments before the interests', () => {
    const segments = Array.from({ length: 80 }, (_, i) => `segment-number-${String(i).padStart(3, '0')}`);
    const text = userContext({ segments, affinities: { 'features/cordless': 1 } }) ?? '';

    expect(text).toHaveLength(500);
    expect(text.startsWith('Strong interest in: cordless. The customer is in the following segments: segment-number-000')).toBe(true);
  });
});

describe('MeilisearchProductSearchCapability user context in a subclass', () => {
  const profile: Profile = { segments: ['vip', 'lapsed', 'affinity.features.cordless.high'], affinities: { 'features/cordless': 1, 'application/power-tools': 1 } };

  it('can name a concept another way', () => {
    class LocalizedNames extends TestableProductSearchCapability {
      protected override conceptNameOf(conceptId: string): string {
        return { 'features/cordless': 'Akku', 'application/power-tools': 'Elværktøj' }[conceptId] ?? conceptId;
      }
    }
    expect(create(LocalizedNames).userContext(profile)).toBe(
      'Strong interest in: Elværktøj, Akku. The customer is in the following segments: lapsed, vip',
    );
  });

  it('can choose which interests count', () => {
    class AllInterests extends TestableProductSearchCapability {
      protected override strongInterestsOf(): string[] {
        return ['everything'];
      }
    }
    expect(create(AllInterests).userContext(profile)).toBe('Strong interest in: everything. The customer is in the following segments: lapsed, vip');
  });

  it('can choose which segments are listed', () => {
    class OnlyVip extends TestableProductSearchCapability {
      protected override userContextSegmentsOf(): string[] {
        return ['vip'];
      }
    }
    expect(create(OnlyVip).userContext(profile)).toBe('Strong interest in: power tools, cordless. The customer is in the following segments: vip');
  });

  it('can change the limits', () => {
    class Tighter extends TestableProductSearchCapability {
      protected override readonly maxStrongInterests = 1;
      protected override readonly maxUserContextLength = 40;
    }
    expect(create(Tighter).userContext(profile)).toBe('Strong interest in: power tools. The cus');
  });

  it('can say the whole thing another way', () => {
    class Shorter extends TestableProductSearchCapability {
      protected override userContextOf(): string | undefined {
        return 'a shopper';
      }
    }
    expect(create(Shorter).searchParams(profile)).toMatchObject({ personalize: { userContext: 'a shopper' } });
  });
});
