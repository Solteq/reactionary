import { describe, expect, it } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  type ProductSearchQueryByTerm,
} from '@reactionary/core';
import type { SearchResponse } from 'meilisearch';
import { MeilisearchProductSearchCapability } from '../capabilities/product-search.capability.js';
import { MeilisearchProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MeilisearchConfigurationSchema } from '../schema/configuration.schema.js';
import type { MeilisearchNativeRecord } from '../schema/search.schema.js';

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

class TestCapability extends MeilisearchProductSearchCapability {
  public buildPayload(payload: ProductSearchQueryByTerm) {
    return this.queryByTermPayload(payload);
  }

  public parseResponse(body: SearchResponse<MeilisearchNativeRecord>, payload: ProductSearchQueryByTerm) {
    return this.parsePaginatedResult(body, payload);
  }
}

function createCapability() {
  return new TestCapability(
    MeilisearchConfigurationSchema.parse({
      apiUrl: 'http://localhost:7700',
      apiKey: 'key',
      indexName: 'products',
      orderIndexName: 'orders',
    }),
    new NoOpCache(),
    createInitialRequestContext(),
    new MeilisearchProductSearchFactory(ProductSearchResultSchema),
  );
}

const response: SearchResponse<MeilisearchNativeRecord> = {
  hits: [
    {
      objectID: 'p1',
      name: 'Drill',
      slug: 'drill',
      variants: [{ sku: 'sku-1', image: 'https://cdn.example/1.png' }],
      productType: { id: 'icecat-cat-8862', name: 'Drills' },
      concepts: { features: ['Cordless'] },
      conceptIds: ['features/cordless'],
    },
    { objectID: 'p2', name: 'Hammer', slug: 'hammer', variants: [] },
  ],
  processingTimeMs: 1,
  query: 'drill',
  estimatedTotalHits: 2,
  limit: 10,
  offset: 0,
  facetDistribution: {
    'concepts.features': { Cordless: 3 },
    'concepts.power-source': { Battery: 2 },
    'productType.name': { Drills: 1 },
    brand_name: { Acme: 4 },
    flags: { ageRestricted: 1 },
    conceptIds: { 'features/cordless': 3 },
  },
};

describe('Meilisearch product search facets that only look like hidden ones', () => {
  it('keeps flagship, flags_extra and conceptIdsLegacy and hides flags, flags.x and conceptIds', () => {
    const body: SearchResponse<MeilisearchNativeRecord> = {
      ...response,
      facetDistribution: {
        brand_name: { Acme: 4 },
        flags: { ageRestricted: 1 },
        'flags.x': { y: 1 },
        conceptIds: { 'features/cordless': 3 },
        flagship: { yes: 2 },
        flags_extra: { a: 1 },
        conceptIdsLegacy: { 'features/cordless': 1 },
      },
    };

    const result = createCapability().parseResponse(body, createQuery());

    // other facets are not renamed, Meilisearch only replaces underscores of its facet keys by spaces
    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['brand_name', 'brand name'],
      ['flagship', 'flagship'],
      ['flags_extra', 'flags extra'],
      ['conceptIdsLegacy', 'conceptIdsLegacy'],
    ]);
  });
});

describe('Meilisearch product search facet configuration', () => {
  const baseConfig = { apiUrl: 'http://localhost:7700', apiKey: 'key', indexName: 'products', orderIndexName: 'orders' };

  function capabilityWith(facets?: { hidden?: string[]; names?: Record<string, string> }) {
    return new TestCapability(
      MeilisearchConfigurationSchema.parse({ ...baseConfig, ...(facets ? { facets } : {}) }),
      new NoOpCache(),
      createInitialRequestContext(),
      new MeilisearchProductSearchFactory(ProductSearchResultSchema),
    );
  }

  it('leaves the defaults when the configuration has no facet options', () => {
    expect(MeilisearchConfigurationSchema.parse(baseConfig).facets).toBeUndefined();
    expect(MeilisearchConfigurationSchema.safeParse({ ...baseConfig, facets: { names: { a: 1 } } }).success).toBe(false);
    expect(capabilityWith().parseResponse(response, createQuery()).facets.map((f) => f.identifier.key)).toEqual([
      'concepts.features',
      'concepts.power-source',
      'productType.name',
      'brand_name',
    ]);
  });

  it('hides and renames the configured facets and keeps the defaults', () => {
    const body: SearchResponse<MeilisearchNativeRecord> = {
      ...response,
      facetDistribution: { ...response.facetDistribution, internal: { x: 1 }, 'internal.sub': { y: 1 } },
    };

    const result = capabilityWith({ hidden: ['internal'], names: { brand_name: 'Brand', 'productType.name': 'Kind' } }).parseResponse(body, createQuery());

    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['concepts.features', 'Features'],
      ['concepts.power-source', 'Power Source'],
      ['productType.name', 'Kind'],
      ['brand_name', 'Brand'],
    ]);
  });
});

describe('Meilisearch product search taxonomy', () => {
  it('maps product type and concepts from hits', () => {
    const result = createCapability().parseResponse(response, createQuery());

    expect(result.items[0].productType).toEqual({ identifier: { key: 'icecat-cat-8862' }, name: 'Drills' });
    expect(result.items[0].concepts).toEqual([
      { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' },
    ]);
    expect(result.items[1].productType).toBeUndefined();
    expect(result.items[1].concepts).toBeUndefined();
  });

  it('names concept facets after their vocabulary and keeps other facet naming', () => {
    const result = createCapability().parseResponse(response, createQuery());

    expect(result.facets.map((f) => [f.identifier.key, f.name])).toEqual([
      ['concepts.features', 'Features'],
      ['concepts.power-source', 'Power Source'],
      ['productType.name', 'Product type'],
      ['brand_name', 'brand name'],
    ]);
  });

  it('never exposes the flags and conceptIds facets', () => {
    const result = createCapability().parseResponse(response, createQuery());

    const keys = result.facets.map((f) => f.identifier.key);
    expect(keys).not.toContain('flags');
    expect(keys).not.toContain('conceptIds');
    expect(keys).toContain('concepts.features');
  });

  it('passes a conceptIds facet filter through to the engine filter', () => {
    const payload = createCapability().buildPayload(
      createQuery([{ facet: { key: 'conceptIds' }, key: 'features/outdoor-rated' }]),
    );

    expect(payload.filter).toBe('"conceptIds"="features/outdoor-rated"');
  });
});
