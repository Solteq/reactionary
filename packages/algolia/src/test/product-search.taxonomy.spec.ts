import { describe, expect, it } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';
import { AlgoliaProductSearchCapability } from '../capabilities/product-search.capability.js';
import { AlgoliaConfigurationSchema } from '../schema/configuration.schema.js';

function createQuery(facets: ProductSearchQueryByTerm['search']['facets'] = []): ProductSearchQueryByTerm {
  return ProductSearchQueryByTermSchema.parse({
    search: {
      term: 'drill',
      facets,
      filters: [],
      paginationOptions: { pageNumber: 1, pageSize: 10 },
    },
  });
}

const response = {
  index: 'products_en',
  page: 0,
  nbHits: 1,
  nbPages: 1,
  hitsPerPage: 10,
  hits: [
    {
      objectID: 'p1',
      name: 'Drill',
      slug: 'drill',
      variants: [{ sku: 'sku-1', image: 'https://cdn.example/1.png' }],
      productType: { id: 'icecat-cat-8862', name: 'Drills' },
      concepts: { features: ['Cordless', 'Outdoor rated'] },
      conceptIds: ['features/cordless', 'features/outdoor-rated'],
    },
    {
      objectID: 'p2',
      name: 'Hammer',
      slug: 'hammer',
      variants: [{ sku: 'sku-2', image: 'https://cdn.example/2.png' }],
    },
  ],
  facets: {
    'concepts.features': { Cordless: 3, 'Outdoor rated': 1 },
    'concepts.power-source': { Battery: 2 },
    'productType.name': { Drills: 1 },
    brand: { Acme: 4 },
    flags: { ageRestricted: 1 },
    conceptIds: { 'features/cordless': 3 },
  },
};

describe('Algolia product search taxonomy', () => {
  const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);

  it('maps product type and concepts from hits', () => {
    const result = factory.parseSearchResult(createInitialRequestContext(), response, createQuery());

    expect(result.items[0].productType).toEqual({ identifier: { key: 'icecat-cat-8862' }, name: 'Drills' });
    expect(result.items[0].concepts).toEqual([
      { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' },
      { identifier: { key: 'features/outdoor-rated' }, vocabulary: 'features', name: 'Outdoor rated' },
    ]);
  });

  it('leaves product type and concepts undefined on hits without them', () => {
    const result = factory.parseSearchResult(createInitialRequestContext(), response, createQuery());

    expect(result.items[1].productType).toBeUndefined();
    expect(result.items[1].concepts).toBeUndefined();
  });

  it('names concept facets after their vocabulary and keeps other facets', () => {
    const result = factory.parseSearchResult(createInitialRequestContext(), response, createQuery());

    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['concepts.features', 'Features'],
      ['concepts.power-source', 'Power Source'],
      ['productType.name', 'Product type'],
      ['brand', 'brand'],
    ]);
  });

  it('never exposes the flags and conceptIds facets', () => {
    const result = factory.parseSearchResult(createInitialRequestContext(), response, createQuery());

    const keys = result.facets.map((f) => f.identifier.key);
    expect(keys).not.toContain('flags');
    expect(keys).not.toContain('conceptIds');
    expect(keys).toContain('concepts.features');
  });
});

describe('Algolia product search facets that only look like hidden ones', () => {
  const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema);

  it('keeps flagship, flags_extra and conceptIdsLegacy and hides flags, flags.x and conceptIds', () => {
    const body = {
      ...response,
      facets: {
        brand: { Acme: 4 },
        flags: { ageRestricted: 1 },
        'flags.x': { y: 1 },
        conceptIds: { 'features/cordless': 3 },
        flagship: { yes: 2 },
        flags_extra: { a: 1 },
        conceptIdsLegacy: { 'features/cordless': 1 },
      },
    };

    const result = factory.parseSearchResult(createInitialRequestContext(), body, createQuery());

    // other facets are neither hidden nor renamed, they keep the name of the engine
    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['brand', 'brand'],
      ['flagship', 'flagship'],
      ['flags_extra', 'flags_extra'],
      ['conceptIdsLegacy', 'conceptIdsLegacy'],
    ]);
  });
});

describe('Algolia product search facet configuration', () => {
  const configured = AlgoliaConfigurationSchema.parse({
    appId: 'app',
    apiKey: 'key',
    indexName: 'products',
    facets: { hidden: ['internal'], names: { brand: 'Brand', 'productType.name': 'Kind' } },
  });

  it('takes the facet options from the configuration and leaves the defaults when they are absent', () => {
    expect(AlgoliaConfigurationSchema.parse({ appId: 'a', apiKey: 'k', indexName: 'i' }).facets).toBeUndefined();
    expect(configured.facets).toEqual({ hidden: ['internal'], names: { brand: 'Brand', 'productType.name': 'Kind' } });
    expect(AlgoliaConfigurationSchema.safeParse({ appId: 'a', apiKey: 'k', indexName: 'i', facets: { hidden: 'x' } }).success).toBe(false);
  });

  it('hides and renames the configured facets and keeps the defaults', () => {
    const factory = new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema, configured.facets);
    const body = { ...response, facets: { ...response.facets, internal: { x: 1 }, 'internal.sub': { y: 1 } } };

    const result = factory.parseSearchResult(createInitialRequestContext(), body, createQuery());

    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['concepts.features', 'Features'],
      ['concepts.power-source', 'Power Source'],
      ['productType.name', 'Kind'],
      ['brand', 'Brand'],
    ]);
  });
});

describe('Algolia product search concept id filter', () => {
  class TestCapability extends AlgoliaProductSearchCapability {
    public buildPayload(payload: ProductSearchQueryByTerm) {
      return this.queryByTermPayload(payload);
    }
  }

  it('passes a conceptIds facet filter through to the engine', () => {
    const context = createInitialRequestContext();
    const capability = new TestCapability(
      new NoOpCache(),
      context,
      AlgoliaConfigurationSchema.parse({ appId: 'app', apiKey: 'key', indexName: 'products' }),
      new AlgoliaProductSearchFactory(AlgoliaProductSearchResultSchema),
    );

    const payload = capability.buildPayload(
      createQuery([{ facet: { key: 'conceptIds' }, key: 'features/outdoor-rated' }]),
    );

    expect(payload.facetFilters).toEqual(['conceptIds:features/outdoor-rated']);
  });
});
