import { describe, expect, it } from 'vitest';
import { BaseCapability } from '../capabilities/base.capability.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { validateInput } from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import {
  ProductSearchIdentifierSchema,
  ProductSearchSortSchema,
  ProductSearchSortWellKnownFieldSchema,
} from '../schemas/models/identifiers.model.js';
import {
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
} from '../schemas/queries/product-search.query.js';

const search = {
  term: 'shirt',
  facets: [{ facet: { key: 'color' }, key: 'red' }],
  filters: [],
  paginationOptions: { pageNumber: 1, pageSize: 20 },
};

class CacheKeyProbe extends BaseCapability {
  public cacheKey(query: object): string {
    return this.generateCacheKeyForQuery('search', query, 'en-US', 'EUR');
  }

  protected getResourceName(): string {
    return 'probe';
  }
}

describe('ProductSearchIdentifierSchema.sort', () => {
  it('is optional and not added to the parsed identifier when omitted', () => {
    const parsed = ProductSearchIdentifierSchema.parse(search);

    expect('sort' in parsed).toBe(false);
    expect(parsed).toEqual(search);
  });

  it('accepts well-known and provider-specific fields', () => {
    for (const field of [...ProductSearchSortWellKnownFieldSchema.options, 'news_from_date']) {
      const parsed = ProductSearchIdentifierSchema.parse({ ...search, sort: { field, direction: 'desc' } });
      expect(parsed.sort).toEqual({ field, direction: 'desc' });
    }
  });

  it('requires a direction of asc or desc', () => {
    expect(ProductSearchSortSchema.safeParse({ field: 'price' }).success).toBe(false);
    expect(ProductSearchSortSchema.safeParse({ field: 'price', direction: 'ASC' }).success).toBe(false);
    expect(ProductSearchSortSchema.safeParse({ field: 'price', direction: 'up' }).success).toBe(false);
  });

  it('validates through the query schema', () => {
    expect(
      ProductSearchQueryByTermSchema.safeParse({ search: { ...search, sort: { field: 'name', direction: 'asc' } } })
        .success,
    ).toBe(true);
    expect(ProductSearchQueryByTermSchema.safeParse({ search: { ...search, sort: 'name' } }).success).toBe(false);
  });
});

describe('product search cache keys', () => {
  const probe = new CacheKeyProbe(new MemoryCache(), createInitialRequestContext());

  it('hashes the caller input as given, so queries without a sort keep their key', () => {
    const query: ProductSearchQueryByTerm = { search };
    const validated = validateInput(query, ProductSearchQueryByTermSchema);

    expect(validated.success).toBe(true);
    if (!validated.success) return;
    expect(validated.value).toBe(query);
    expect(probe.cacheKey(validated.value)).toBe(probe.cacheKey({ search: { ...search } }));
  });

  it('separates queries by sort field and direction', () => {
    const unsorted = probe.cacheKey({ search });
    const byPriceAsc = probe.cacheKey({ search: { ...search, sort: { field: 'price', direction: 'asc' } } });
    const byPriceDesc = probe.cacheKey({ search: { ...search, sort: { field: 'price', direction: 'desc' } } });
    const byNameAsc = probe.cacheKey({ search: { ...search, sort: { field: 'name', direction: 'asc' } } });

    expect(new Set([unsorted, byPriceAsc, byPriceDesc, byNameAsc]).size).toBe(4);
  });
});
