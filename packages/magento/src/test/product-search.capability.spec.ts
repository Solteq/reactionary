import type { FacetValueIdentifier, ProductSearchQueryByTerm } from '@reactionary/core';
import {
  CategorySchema,
  MemoryCache,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MagentoProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MagentoConfigurationSchema, type MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCategory, MagentoProduct } from '../schema/magento.types.js';

const config: MagentoConfiguration = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
});

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

function storefrontScope(startIndex: number, visibility = '2,4') {
  return {
    ...filterGroup(startIndex, [['status', '1', 'eq']]),
    ...filterGroup(startIndex + 1, [['visibility', visibility, 'in']]),
  };
}

const pagination = {
  'searchCriteria[pageSize]': '20',
  'searchCriteria[currentPage]': '1',
};

/** Categories Magento knows: 12 has external_id CAT-12, 14 has none (keyed by its id). */
const CATEGORIES: MagentoCategory[] = [
  { id: 12, parent_id: 2, name: 'Shirts', custom_attributes: [{ attribute_code: 'external_id', value: 'CAT-12' }] },
  { id: 14, parent_id: 2, name: 'Pants', custom_attributes: [] },
];

function categoryList(path: string): { items: MagentoCategory[]; total_count: number } {
  const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  const field = params.get('searchCriteria[filterGroups][0][filters][0][field]');
  const values = (params.get('searchCriteria[filterGroups][0][filters][0][value]') ?? '').split(',');
  const items = CATEGORIES.filter((category) =>
    field === 'entity_id'
      ? values.includes(String(category.id))
      : values.includes(String(category.custom_attributes?.find((a) => a.attribute_code === 'external_id')?.value)),
  );
  return { items, total_count: items.length };
}

function product(partial: Partial<MagentoProduct> = {}): MagentoProduct {
  return {
    id: 10,
    sku: 'MH01',
    name: 'Hoodie',
    type_id: 'simple',
    custom_attributes: [{ attribute_code: 'external_id', value: 'P-1' }],
    media_gallery_entries: [
      { id: 1, media_type: 'image', label: null, position: 2, disabled: false, types: ['image'], file: '/a.jpg' },
      { id: 2, media_type: 'image', label: null, position: 1, disabled: false, types: ['small_image'], file: '/b.jpg' },
    ],
    ...partial,
  };
}

describe('MagentoProductSearchCapability.queryByTerm', () => {
  let client: MagentoClient;
  let search: MockInstance<MagentoClient['searchProducts']>;
  let graphql: MockInstance<MagentoClient['graphqlRequest']>;
  let capability: MagentoProductSearchCapability;

  function createCapability(configuration: MagentoConfiguration = config) {
    return new MagentoProductSearchCapability(
      configuration,
      new MemoryCache(),
      createInitialRequestContext(),
      client,
      new MagentoProductSearchFactory(ProductSearchResultSchema, configuration),
    );
  }

  beforeEach(() => {
    client = new MagentoClient(config, createInitialRequestContext());
    search = vi.spyOn(client, 'searchProducts').mockResolvedValue({ items: [], total_count: 0 });
    graphql = vi.spyOn(client, 'graphqlRequest').mockResolvedValue({ products: { aggregations: [] } });
    vi.spyOn(client, 'catalogRequest').mockImplementation(async (path: string) => categoryList(path));
    capability = createCapability();
  });

  async function sentParams(payload: ProductSearchQueryByTerm): Promise<Record<string, string>> {
    const result = await capability.queryByTerm(payload);
    expect(result.success).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    const params = search.mock.calls[0][0];
    return Object.fromEntries(params.entries());
  }

  it('scopes to enabled, catalog-visible products when browsing', async () => {
    expect(await sentParams(query())).toEqual({
      ...storefrontScope(0),
      ...pagination,
    });
  });

  it('matches the term on name OR sku, strips every wildcard, escapes LIKE characters and scopes to search visibility', async () => {
    const params = await sentParams(query({ term: ' *50%_off* ' }));

    expect(params).toEqual({
      ...filterGroup(0, [
        ['name', '%50\\%\\_off%', 'like'],
        ['sku', '%50\\%\\_off%', 'like'],
      ]),
      ...storefrontScope(1, '3,4'),
      ...pagination,
    });
  });

  it('ORs multiple values of one facet and ANDs distinct facets', async () => {
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

  it('applies search.filters and turns price buckets into a range', async () => {
    const params = await sentParams(
      query({ filters: ['brand:3,4'], facets: [facet('price', '10_20'), facet('price', '20_30')] }),
    );

    expect(params).toEqual({
      ...filterGroup(0, [
        ['brand', '3', 'eq'],
        ['brand', '4', 'eq'],
      ]),
      ...filterGroup(1, [['price', '10', 'gteq']]),
      ...filterGroup(2, [['price', '30', 'lt']]),
      ...storefrontScope(3),
      ...pagination,
    });
  });

  it('rejects malformed search.filters as InvalidInput', async () => {
    const result = await capability.queryByTerm(query({ filters: ['not a filter'] }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('InvalidInput');
    expect(search).not.toHaveBeenCalled();
  });

  it.each([
    ['name', 'asc', 'name', 'ASC'],
    ['price', 'desc', 'price', 'DESC'],
    ['createdAt', 'desc', 'created_at', 'DESC'],
    ['news_from_date', 'asc', 'news_from_date', 'ASC'],
  ] as const)('sorts by %s %s as REST sort order %s %s', async (field, direction, restField, restDirection) => {
    const params = await sentParams(query({ term: 'hood', sort: { field, direction } }));

    expect(params).toEqual({
      ...filterGroup(0, [
        ['name', '%hood%', 'like'],
        ['sku', '%hood%', 'like'],
      ]),
      ...storefrontScope(1, '3,4'),
      'searchCriteria[sortOrders][0][field]': restField,
      'searchCriteria[sortOrders][0][direction]': restDirection,
      'searchCriteria[sortOrders][1][field]': 'entity_id',
      'searchCriteria[sortOrders][1][direction]': 'ASC',
      ...pagination,
    });
  });

  it('keeps the default order for relevance', async () => {
    expect(await sentParams(query({ sort: { field: 'relevance', direction: 'desc' } }))).toEqual({
      ...storefrontScope(0),
      ...pagination,
    });
  });

  it.each(['Name', 'price desc', '1st_field', 'created-at', ''])(
    'rejects the sort field "%s" as InvalidInput',
    async (field) => {
      const result = await capability.queryByTerm(query({ sort: { field, direction: 'asc' } }));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('InvalidInput');
      expect(search).not.toHaveBeenCalled();
      expect(graphql).not.toHaveBeenCalled();
    },
  );

  it('does not pass the sort to the GraphQL aggregations query', async () => {
    await sentParams(query({ term: 'hood', sort: { field: 'price', direction: 'asc' } }));

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(graphql).toHaveBeenCalledWith(expect.any(String), { search: 'hood', filter: {} });
    expect(graphql.mock.calls[0][0]).not.toMatch(/sort/);
  });

  it('lets subclasses override the sort orders', async () => {
    class TieBreakingSearch extends MagentoProductSearchCapability {
      protected override getSortOrders(payload: ProductSearchQueryByTerm) {
        const orders = super.getSortOrders(payload);
        return Array.isArray(orders) ? [...orders, { field: 'entity_id', direction: 'ASC' as const }] : orders;
      }
    }
    capability = new TieBreakingSearch(
      config,
      new MemoryCache(),
      createInitialRequestContext(),
      client,
      new MagentoProductSearchFactory(ProductSearchResultSchema, config),
    );

    const params = await sentParams(query({ sort: { field: 'name', direction: 'asc' } }));

    expect(params).toMatchObject({
      'searchCriteria[sortOrders][0][field]': 'name',
      'searchCriteria[sortOrders][0][direction]': 'ASC',
      'searchCriteria[sortOrders][1][field]': 'entity_id',
      'searchCriteria[sortOrders][1][direction]': 'ASC',
    });
  });

  it('translates category keys (external_id or entity id) to entity ids', async () => {
    const categoryFacet = await capability.createCategoryNavigationFilter({
      categoryPath: [CategorySchema.parse({ identifier: { key: 'CAT-12' } })],
    });
    expect(categoryFacet.success).toBe(true);
    if (!categoryFacet.success) return;
    expect(categoryFacet.value).toEqual(facet('categories', 'CAT-12'));

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
        term: 'vitamin',
        categoryFilter: facet('categories', 'CAT-12'),
        facets: [facet('color', '49')],
      }),
    );

    expect(params).toEqual({
      ...filterGroup(0, [
        ['name', '%vitamin%', 'like'],
        ['sku', '%vitamin%', 'like'],
      ]),
      ...filterGroup(1, [['category_id', '12', 'eq']]),
      ...filterGroup(2, [['color', '49', 'eq']]),
      ...storefrontScope(3, '3,4'),
      ...pagination,
    });
  });

  it('returns an empty page for an unknown category instead of the whole catalog', async () => {
    const result = await capability.queryByTerm(query({ categoryFilter: facet('categories', 'NOPE') }));
    expect(search).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) expect(result.value.totalCount).toBe(0);
  });

  it('rejects an empty category path', async () => {
    const result = await capability.createCategoryNavigationFilter({ categoryPath: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('InvalidInput');
  });

  it('maps the GraphQL aggregations to facets, the category facet keyed by category key', async () => {
    graphql.mockResolvedValue({
      products: {
        aggregations: [
          {
            attribute_code: 'color',
            label: 'Color',
            count: 2,
            options: [
              { label: 'Red', value: '49', count: 3 },
              { label: 'Blue', value: '50', count: 1 },
            ],
          },
          {
            attribute_code: 'category_uid',
            label: 'Category',
            count: 2,
            options: [
              { label: 'Shirts', value: btoa('12'), count: 2 },
              { label: 'Ghost', value: btoa('999'), count: 1 },
            ],
          },
        ],
      },
    });

    const result = await capability.queryByTerm(query({ term: 'hood', facets: [facet('color', '49')] }));

    expect(graphql).toHaveBeenCalledWith(expect.any(String), {
      search: 'hood',
      filter: { color: { in: ['49'] } },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.facets).toEqual([
      {
        identifier: { key: 'color' },
        name: 'Color',
        values: [
          { identifier: facet('color', '49'), name: 'Red', count: 3, active: true },
          { identifier: facet('color', '50'), name: 'Blue', count: 1, active: false },
        ],
      },
      {
        identifier: { key: 'categories' },
        name: 'Category',
        values: [{ identifier: facet('categories', 'CAT-12'), name: 'Shirts', count: 2, active: false }],
      },
    ]);
  });

  it('still returns the items when the facet query fails', async () => {
    search.mockResolvedValue({ items: [product()], total_count: 1 });
    graphql.mockRejectedValue(
      new MagentoApiError({ transport: 'graphql', status: 200, method: 'POST', url: 'https://example.com/graphql' }),
    );

    const result = await capability.queryByTerm(query());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.facets).toEqual([]);
  });

  it('returns a typed error when the REST search fails', async () => {
    search.mockRejectedValue(
      new MagentoApiError({ transport: 'rest', status: 401, method: 'GET', url: 'https://example.com/rest/V1/products' }),
    );
    const result = await capability.queryByTerm(query());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('Generic');
  });

  it('keys items like the product capability and keeps configurable products off PLP add-to-cart', async () => {
    search.mockResolvedValue({
      items: [product(), product({ id: 11, sku: 'MH02', type_id: 'configurable', custom_attributes: [] })],
      total_count: 2,
    });

    const result = await capability.queryByTerm(query());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const [simple, configurable] = result.value.items;
    expect(simple.identifier.key).toBe('P-1');
    expect(simple.canAddToCartDirectly).toBe(true);
    expect(simple.variants[0].image.sourceUrl).toBe('https://example.com/media/catalog/product/b.jpg');
    expect(configurable.identifier.key).toBe('11');
    expect(configurable.canAddToCartDirectly).toBe(false);
  });

  it('uses the DAM image when mediaSource is EXTERNAL', async () => {
    capability = createCapability({ ...config, mediaSource: 'EXTERNAL' });
    search.mockResolvedValue({
      items: [
        product({
          custom_attributes: [
            {
              attribute_code: 'original_dam_reference',
              value: JSON.stringify({ images: [{ url: 'https://dam.example/a.jpg' }] }),
            },
          ],
        }),
      ],
      total_count: 1,
    });

    const result = await capability.queryByTerm(query());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items[0].variants[0].image.sourceUrl).toBe('https://dam.example/a.jpg');
  });
});
