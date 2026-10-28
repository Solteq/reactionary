import { describe, expect, it } from 'vitest';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { ProductSearchQueryByTerm } from '@reactionary/core';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';

class TestableProductSearchCapability extends MeilisearchProductSearchCapability {
  public buildSearchParams(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }
}

class StricterEscapingCapability extends TestableProductSearchCapability {
  protected override escapeFilterValue(value: string): string {
    return super.escapeFilterValue(value).replace(/'/g, "\\'");
  }
}

const config = MeilisearchConfigurationSchema.parse({
  apiUrl: 'http://meilisearch.invalid',
  apiKey: 'key',
  indexName: 'products',
  orderIndexName: 'orders',
});

const createCapability = (type: typeof TestableProductSearchCapability = TestableProductSearchCapability) =>
  new type(
    config,
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );

const createPayload = (search: Partial<ProductSearchQueryByTerm['search']>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: {
      term: '',
      facets: [],
      filters: [],
      paginationOptions: { pageNumber: 1, pageSize: 20 },
      ...search,
    },
  });

/**
 * Removes every quoted string, honouring backslash escapes the way Meilisearch's filter parser does. What is left is
 * the structure of the expression: attribute names that are not quoted, operators, parentheses and the AND/OR glue.
 */
const withoutQuotedStrings = (filter: unknown): string => {
  expect(typeof filter).toBe('string');
  return String(filter).replace(/"(?:[^"\\]|\\.)*"/g, '""');
};

describe('MeilisearchProductSearchCapability filters', () => {
  it('has no filter when nothing restricts the search', () => {
    expect(createCapability().buildSearchParams(createPayload({})).filter).toBeUndefined();
  });

  it('builds the expected filter for ordinary facets and categories', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        facets: [{ facet: { key: 'brand' }, key: 'Acme' }],
        categoryFilter: { facet: { key: 'categories' }, key: 'Tools > Hammers' },
      }),
    );
    expect(params.filter).toBe('categories = "Tools > Hammers" AND "brand"="Acme"');
  });

  it('keeps a facet value containing a quote and an OR clause inside its string', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        filters: ['visibility = "public"'],
        facets: [{ facet: { key: 'brand' }, key: 'x" OR visibility != "' }],
      }),
    );
    expect(params.filter).toBe('(visibility = "public") AND "brand"="x\\" OR visibility != \\""');
    expect(withoutQuotedStrings(params.filter)).toBe('(visibility = "") AND ""=""');
  });

  it('keeps a facet key containing a quote inside its string', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        facets: [{ facet: { key: 'brand" = "a" OR "visibility' }, key: 'Acme' }],
      }),
    );
    expect(params.filter).toBe('"brand\\" = \\"a\\" OR \\"visibility"="Acme"');
    expect(withoutQuotedStrings(params.filter)).toBe('""=""');
  });

  it('keeps a category value containing a quote inside its string', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        categoryFilter: { facet: { key: 'categories' }, key: 'a" OR visibility != "' },
      }),
    );
    expect(params.filter).toBe('categories = "a\\" OR visibility != \\""');
    expect(withoutQuotedStrings(params.filter)).toBe('categories = ""');
  });

  it('applies the same escaping to a category given as a facet', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        facets: [{ facet: { key: 'categories' }, key: 'a" OR visibility != "' }],
      }),
    );
    expect(params.filter).toBe('categories = "a\\" OR visibility != \\""');
  });

  it('escapes backslashes so a trailing backslash cannot escape the closing quote', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        facets: [
          { facet: { key: 'brand' }, key: 'Acme\\' },
          { facet: { key: 'color' }, key: 'red\\" OR "a"="a' },
        ],
      }),
    );
    expect(params.filter).toBe('"brand"="Acme\\\\" AND "color"="red\\\\\\" OR \\"a\\"=\\"a"');
    expect(withoutQuotedStrings(params.filter)).toBe('""="" AND ""=""');
  });

  it('parenthesises supplied filters so an OR cannot bypass the category restriction', () => {
    const params = createCapability().buildSearchParams(
      createPayload({
        filters: ['a = 1 OR b = 2'],
        categoryFilter: { facet: { key: 'categories' }, key: 'Tools' },
        facets: [{ facet: { key: 'brand' }, key: 'Acme' }],
      }),
    );
    expect(params.filter).toBe('(a = 1 OR b = 2) AND categories = "Tools" AND "brand"="Acme"');
  });

  it('parenthesises every supplied filter', () => {
    const params = createCapability().buildSearchParams(createPayload({ filters: ['a = 1 OR b = 2', 'c = 3'] }));
    expect(params.filter).toBe('(a = 1 OR b = 2) AND (c = 3)');
  });

  it('lets a subclass override the escaping', () => {
    const params = createCapability(StricterEscapingCapability).buildSearchParams(
      createPayload({ facets: [{ facet: { key: 'brand' }, key: "O'Neil" }] }),
    );
    expect(params.filter).toBe(`"brand"="O\\'Neil"`);
  });
});
