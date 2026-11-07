import { describe, expect, it } from 'vitest';
import type { ProductPagedSearchResponse } from '@commercetools/platform-sdk';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { ProductSearchQueryByTerm, SearchFacetPolicyOptions } from '@reactionary/core';
import { CommercetoolsProductSearchCapability } from '../capabilities/product-search.capability.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { CommercetoolsConfigurationSchema } from '../schema/configuration.schema.js';
import { CommercetoolsAPI } from '../core/client.js';

const query = (search: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  });

const config = (facets?: SearchFacetPolicyOptions) =>
  CommercetoolsConfigurationSchema.parse({
    projectKey: 'p',
    authUrl: 'https://auth.invalid',
    apiUrl: 'https://api.invalid',
    clientId: 'id',
    clientSecret: 'secret',
    facets,
  });

// The client is never asked for a token: a refused search returns before any request
const capability = () => {
  const context = createInitialRequestContext();
  const cfg = config();
  return new CommercetoolsProductSearchCapability(
    cfg,
    new NoOpCache(),
    context,
    new CommercetoolsAPI(cfg, context),
    new CommercetoolsProductSearchFactory(ProductSearchResultSchema),
  );
};

const distinct = (name: string, keys: string[]) => ({
  name,
  buckets: keys.map((key, index) => ({ key, count: index + 1 })),
});

const response = (facets: unknown[]): ProductPagedSearchResponse =>
  ({ offset: 0, limit: 10, total: 0, results: [], facets }) as unknown as ProductPagedSearchResponse;

const parse = (facets: SearchFacetPolicyOptions | undefined, search: Record<string, unknown> = {}) => {
  const context = createInitialRequestContext();
  return new CommercetoolsProductSearchFactory(ProductSearchResultSchema, facets).parseSearchResult(
    context,
    response([distinct('manufacturer', ['Bosch', 'Makita']), distinct('color', ['red']), distinct('flags', ['new'])]),
    query(search),
  );
};

describe('commercetools typed search filters', () => {
  const refused: [string, Record<string, unknown>][] = [
    ['priceFilter', { priceFilter: { min: 10, max: 20 } }],
    ['ratingFilter', { ratingFilter: { min: 4 } }],
    ['availabilityFilter', { availabilityFilter: { online: true } }],
    ['conceptFilter', { conceptFilter: [{ key: 'features/cordless' }] }],
    ['conceptContext', { conceptContext: [{ key: 'features/cordless' }] }],
  ];

  it.each(refused)('refuses %s instead of ignoring it', async (name, search) => {
    const result = await capability().queryByTerm(query(search));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'InvalidInput' });
      expect(JSON.stringify(result.error)).toContain(name);
    }
  });

  it('refuses a facet that belongs to a typed filter', async () => {
    const result = await capability().queryByTerm(query({ facets: [{ facet: { key: 'reviewBucket' }, key: '4' }] }));

    expect(result.success).toBe(false);
  });
});

describe('commercetools search result facets', () => {
  it('returns every facet as an attribute facet', () => {
    const result = parse(undefined);

    expect(result.facets.map((f) => f.semantic)).toEqual(['attribute', 'attribute']);
    expect(result.facets.map((f) => f.semantic === 'attribute' && f.multiselect)).toEqual([false, false]);
  });

  it('marks the facets of the policy as multiselect', () => {
    const result = parse({ multiselect: ['manufacturer'] });

    expect(result.facets.map((f) => f.semantic === 'attribute' && [f.identifier.key, f.multiselect])).toEqual([
      ['manufacturer', true],
      ['color', false],
    ]);
  });

  it('hides the facets of the policy and the flags by default', () => {
    const result = parse({ hidden: ['color'] });

    expect(result.facets.map((f) => f.semantic === 'attribute' && f.identifier.key)).toEqual(['manufacturer']);
  });

  it('orders and names the facets with the policy', () => {
    const result = parse({ order: ['color', 'manufacturer'], names: { color: 'Colour' } });

    expect(result.facets.map((f) => f.semantic === 'attribute' && f.name)).toEqual(['Colour', 'manufacturer']);
  });

  it('echoes the typed filters and no multiselect in the identifier', () => {
    const result = parse(undefined, { priceFilter: { min: 1 } });

    expect(result.identifier.priceFilter).toEqual({ min: 1 });
    expect(result.identifier).not.toHaveProperty('multiselect');
  });
});
