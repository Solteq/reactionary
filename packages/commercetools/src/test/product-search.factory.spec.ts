import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProductPagedSearchResponse } from '@commercetools/platform-sdk';
import {
  createInitialRequestContext,
  ProductSearchResultSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';

/**
 * Offline tests for mapping recorded Commercetools product search responses.
 * Fixtures are raw response bodies from POST /{projectKey}/products/search.
 */
const FIXTURES = new URL('./__fixtures__/product-search/', import.meta.url);

function readSearchResponse(name: string): ProductPagedSearchResponse {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));
}

function setup() {
  const context = createInitialRequestContext();
  const factory = new CommercetoolsProductSearchFactory(ProductSearchResultSchema);
  const query = {
    search: {
      term: 'laptop',
      facets: [],
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 2,
      },
    },
  } satisfies ProductSearchQueryByTerm;

  return { context, factory, query };
}

describe('Commercetools product search factory', () => {
  // Recorded with limit=2, offset=0, matching exactly 2 products.
  const response = readSearchResponse('laptop-limit-2.json');

  it('maps the items of a recorded response', () => {
    const { context, factory, query } = setup();

    const result = factory.parseSearchResult(context, response, query);

    expect(result.items.map((item) => item.identifier.key)).toEqual(
      response.results.map((r) => r.productProjection?.key),
    );
  });

  it('reports a single page when the total fits exactly in one page', () => {
    const { context, factory, query } = setup();

    const result = factory.parseSearchResult(context, response, query);

    expect(result.totalCount).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.pageNumber).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('rounds up to include a partially filled last page', () => {
    const { context, factory, query } = setup();

    const result = factory.parseSearchResult(context, { ...response, total: 3 }, query);

    expect(result.totalPages).toBe(2);
  });

  describe('Color variant option', () => {
    function withMasterVariantColor(value: unknown): ProductPagedSearchResponse {
      return {
        ...response,
        results: response.results.map((result) => ({
          ...result,
          productProjection: result.productProjection && {
            ...result.productProjection,
            masterVariant: {
              ...result.productProjection.masterVariant,
              attributes: [{ name: 'Color', value }],
            },
          },
        })),
      };
    }

    it.each([
      { type: 'text', value: 'Blue', key: 'Blue', label: 'Blue' },
      { type: 'localized text', value: { en: 'Red', da: 'Rød' }, key: 'Rød', label: 'Rød' },
      { type: 'localized text without the language', value: { en: 'Red' }, key: 'Red', label: 'Red' },
      { type: 'enum', value: { key: 'black', label: 'Black' }, key: 'black', label: 'Black' },
      { type: 'localized enum', value: { key: 'green', label: { en: 'Green', da: 'Grøn' } }, key: 'green', label: 'Grøn' },
      { type: 'localized enum without the language', value: { key: 'green', label: { en: 'Green' } }, key: 'green', label: 'Green' },
    ])('maps a $type attribute', ({ value, key, label }) => {
      const { context, factory, query } = setup();
      context.languageContext.locale = 'da-DK';

      const result = factory.parseSearchResult(context, withMasterVariantColor(value), query);
      const option = result.items[0].variants[0].options;

      expect(option?.identifier).toEqual({ key: 'Color' });
      expect(option?.name).toBe('Color');
      expect(option?.value).toEqual({
        identifier: { option: { key: 'Color' }, key },
        label,
      });
    });
  });

  it('reports no pages when nothing matches', () => {
    const { context, factory, query } = setup();

    const result = factory.parseSearchResult(
      context,
      { ...response, total: 0, results: [] },
      query,
    );

    expect(result.totalPages).toBe(0);
  });
});
