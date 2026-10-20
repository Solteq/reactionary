import type { FacetValueIdentifier, ProductSearchQueryByTerm } from '@reactionary/core';
import {
  CategorySchema,
  NoOpCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductSearchCapability } from '../capabilities/product-search.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

function facet(code: string, value: string): FacetValueIdentifier {
  return { facet: { key: code }, key: value };
}

function query(search: Partial<ProductSearchQueryByTerm['search']> = {}): ProductSearchQueryByTerm {
  return {
    search: {
      term: '',
      facets: [],
      filters: [],
      paginationOptions: { pageNumber: 1, pageSize: 20 },
      ...search,
    },
  };
}

function filterGroup(index: number, filters: Array<[field: string, value: string, condition: string]>) {
  const entries: Record<string, string> = {};
  filters.forEach(([field, value, condition], filterIndex) => {
    const prefix = `searchCriteria[filterGroups][${index}][filters][${filterIndex}]`;
    entries[`${prefix}[field]`] = field;
    entries[`${prefix}[value]`] = value;
    entries[`${prefix}[condition_type]`] = condition;
  });
  return entries;
}

function storefrontScope(startIndex: number) {
  return {
    ...filterGroup(startIndex, [['status', '1', 'eq']]),
    ...filterGroup(startIndex + 1, [['visibility', '2,4', 'in']]),
  };
}

const pagination = {
  'searchCriteria[pageSize]': '20',
  'searchCriteria[currentPage]': '1',
};

describe('MagentoProductSearchCapability.queryByTerm', () => {
  let search: ReturnType<typeof vi.fn>;
  let capability: MagentoProductSearchCapability;

  beforeEach(() => {
    search = vi.fn().mockResolvedValue({ items: [], total_count: 0 });
    const magentoApi = {
      getClient: vi.fn().mockResolvedValue({ store: { product: { search } } }),
    };
    capability = new MagentoProductSearchCapability(
      config,
      new NoOpCache(),
      createInitialRequestContext(),
      magentoApi as unknown as MagentoClient,
      new MagentoProductSearchFactory(ProductSearchResultSchema, config),
    );
  });

  async function sentParams(payload: ProductSearchQueryByTerm): Promise<Record<string, string>> {
    const result = await capability.queryByTerm(payload);
    expect(result.success).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    const params: URLSearchParams = search.mock.calls[0][0];
    return Object.fromEntries(params.entries());
  }

  it('scopes to enabled, catalog/search-visible products when no filters are selected', async () => {
    expect(await sentParams(query())).toEqual({
      ...storefrontScope(0),
      ...pagination,
    });
  });

  it('ORs multiple values of one facet within a single filter group', async () => {
    const params = await sentParams(query({ facets: [facet('color', '49'), facet('color', '50')] }));

    expect(params).toEqual({
      ...filterGroup(0, [
        ['color', '49', 'eq'],
        ['color', '50', 'eq'],
      ]),
      ...storefrontScope(1),
      ...pagination,
    });
  });

  it('ANDs distinct facets as separate filter groups', async () => {
    const params = await sentParams(
      query({ facets: [facet('color', '49'), facet('manufacturer', '7'), facet('color', '50')] }),
    );

    expect(params).toEqual({
      ...filterGroup(0, [
        ['color', '49', 'eq'],
        ['color', '50', 'eq'],
      ]),
      ...filterGroup(1, [['manufacturer', '7', 'eq']]),
      ...storefrontScope(2),
      ...pagination,
    });
  });

  it('maps category navigation facets onto a single category_id in-filter', async () => {
    const categoryFacet = await capability.createCategoryNavigationFilter({
      categoryPath: [CategorySchema.parse({ identifier: { key: '12' } })],
    });
    expect(categoryFacet.success).toBe(true);
    if (!categoryFacet.success) return;

    const params = await sentParams(query({ facets: [categoryFacet.value, facet('categories', '14')] }));

    // Magento's category_id filter ANDs filters within a group, so the OR has to be a single `in`.
    expect(params).toEqual({
      ...filterGroup(0, [['category_id', '12,14', 'in']]),
      ...storefrontScope(1),
      ...pagination,
    });
  });

  it('keeps the term and category filter ahead of facets and scoping', async () => {
    const params = await sentParams(
      query({
        term: ' vitamin* ',
        categoryFilter: facet('categories', '12'),
        facets: [facet('color', '49')],
      }),
    );

    expect(params).toEqual({
      ...filterGroup(0, [['name', '%vitamin%', 'like']]),
      ...filterGroup(1, [['category_id', '12', 'eq']]),
      ...filterGroup(2, [['color', '49', 'eq']]),
      ...storefrontScope(3),
      ...pagination,
    });
  });
});
