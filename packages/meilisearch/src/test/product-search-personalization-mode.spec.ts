import { describe, expect, it } from 'vitest';
import {
  AffinityRanking,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type SearchPersonalizationOptions,
} from '@reactionary/core';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

class TestableCapability extends MeilisearchProductSearchCapability {
  public searchParams(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }

  public reordered(result: ProductSearchResult, payload: ProductSearchQueryByTerm) {
    return this.personalize(result, payload);
  }
}

const create = (personalization?: SearchPersonalizationOptions, type: typeof TestableCapability = TestableCapability) =>
  new type(
    MeilisearchConfigurationSchema.parse({
      apiUrl: 'http://meilisearch.invalid',
      apiKey: 'key',
      indexName: 'products',
      orderIndexName: 'orders',
      ...(personalization ? { personalization } : {}),
    }),
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );

const payload = (affinities: Record<string, number>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: '', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } },
    personalizationProfile: { identifier: { key: 'visitor-1' }, blurb: '', segments: ['vip'], affinities },
  });

const item = (key: string, ...concepts: string[]) => ({
  identifier: { key },
  name: key,
  slug: key,
  variants: [],
  concepts: concepts.map((id) => ({ identifier: { key: id }, vocabulary: id.split('/')[0], name: id })),
});

const result = (...items: ReturnType<typeof item>[]) => ({ items }) as unknown as ProductSearchResult;
const keys = (r: ProductSearchResult) => r.items.map((i) => i.identifier.key);

const interested = payload({ 'features/cordless': 1 });
const items = () => [item('a'), item('b'), item('c'), item('d'), item('e'), item('f'), item('g'), item('h', 'features/cordless')];

describe('Meilisearch product search personalization mode', () => {
  it('lets the engine personalize by default, as before: the profile goes to Meilisearch and the page is left as it is', () => {
    const capability = create();

    expect(capability.searchParams(interested)).toHaveProperty('personalize.userContext');
    expect(keys(capability.reordered(result(...items()), interested))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(create({ mode: 'engine' }).searchParams(interested)).toHaveProperty('personalize.userContext');
  });

  it('reorders the page itself in affinity mode, and sends Meilisearch no personalization', () => {
    const capability = create({ mode: 'affinity' });

    expect(capability.searchParams(interested)).not.toHaveProperty('personalize');
    const reordered = keys(capability.reordered(result(...items()), interested));
    expect(reordered.indexOf('h')).toBeLessThan(7);
    expect(reordered.slice(0, 2)).toEqual(['a', 'b']);
  });

  it('keeps the rest of the result in affinity mode', () => {
    const capability = create({ mode: 'affinity' });
    const page = { ...result(...items()), totalCount: 99, pageNumber: 2 } as ProductSearchResult;

    const reordered = capability.reordered(page, interested);

    expect(reordered.totalCount).toBe(99);
    expect(reordered.pageNumber).toBe(2);
  });

  it('personalizes nothing in none mode', () => {
    const capability = create({ mode: 'none' });

    expect(capability.searchParams(interested)).not.toHaveProperty('personalize');
    expect(keys(capability.reordered(result(...items()), interested))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('leaves the page as it is for a visitor with no interests, or no profile', () => {
    const capability = create({ mode: 'affinity' });
    const noProfile = ProductSearchQueryByTermSchema.parse({ search: { term: '', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 20 } } });

    expect(keys(capability.reordered(result(...items()), payload({})))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(keys(capability.reordered(result(...items()), noProfile))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('uses the ranking a subclass makes, with the strength of the options', () => {
    let seen: SearchPersonalizationOptions | undefined;
    class Reversing extends AffinityRanking {
      override rank<T extends { identifier: { key: string } }>(hits: readonly T[]): T[] {
        return [...hits].reverse();
      }
    }
    class Custom extends TestableCapability {
      protected override createSearchRanking(options?: SearchPersonalizationOptions): AffinityRanking {
        seen = options;
        return new Reversing(options);
      }
    }

    const capability = create({ mode: 'affinity', strength: 0.9 }, Custom);

    // made on first use, not in the constructor
    expect(seen).toBeUndefined();
    expect(keys(capability.reordered(result(item('a'), item('b')), interested))).toEqual(['b', 'a']);
    expect(seen).toMatchObject({ mode: 'affinity', strength: 0.9 });
  });

  it('can read a field of its own when it makes the ranking, since that happens after the constructors', () => {
    class WithField extends TestableCapability {
      private readonly strengthOfMine = 0.123;

      protected override createSearchRanking(options?: SearchPersonalizationOptions): AffinityRanking {
        return new AffinityRanking({ ...options, strength: this.strengthOfMine });
      }

      public strengthOfRanking() {
        return (this.ranking as unknown as { strength: number }).strength;
      }
    }

    expect(create({ mode: 'affinity' }, WithField as unknown as typeof TestableCapability)).toBeDefined();
    expect((create({ mode: 'affinity' }, WithField as unknown as typeof TestableCapability) as unknown as WithField).strengthOfRanking()).toBe(0.123);
  });
});
