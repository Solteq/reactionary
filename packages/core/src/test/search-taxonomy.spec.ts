import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_FACET_POLICY, SearchFacetPolicyOptionsSchema, createSearchFacetPolicy, getTaxonomyFacetName, getConceptFacetName, isHiddenSearchFacet, parseSearchDocumentTaxonomy } from '../utils/search-taxonomy.js';

describe('getConceptFacetName', () => {
  it('names a concept facet after its title-cased vocabulary', () => {
    expect(getConceptFacetName('concepts.features')).toBe('Features');
    expect(getConceptFacetName('concepts.power-source')).toBe('Power Source');
    expect(getConceptFacetName('concepts.use_case')).toBe('Use Case');
  });

  it('ignores facets that are no concept facets', () => {
    expect(getConceptFacetName('conceptIds')).toBeUndefined();
    expect(getConceptFacetName('concepts.')).toBeUndefined();
    expect(getConceptFacetName('brand')).toBeUndefined();
  });
});

describe('getTaxonomyFacetName', () => {
  it('names the product type facet and concept facets', () => {
    expect(getTaxonomyFacetName('productType.name')).toBe('Product type');
    expect(getTaxonomyFacetName('concepts.features')).toBe('Features');
    expect(getTaxonomyFacetName('brand')).toBeUndefined();
  });
});

describe('isHiddenSearchFacet', () => {
  it('hides the keys themselves and what is nested under them', () => {
    expect(isHiddenSearchFacet('flags')).toBe(true);
    expect(isHiddenSearchFacet('flags.value')).toBe(true);
    expect(isHiddenSearchFacet('flags.a.b')).toBe(true);
    expect(isHiddenSearchFacet('conceptIds')).toBe(true);
    expect(isHiddenSearchFacet('conceptIds.x')).toBe(true);
    expect(isHiddenSearchFacet('concepts.features')).toBe(false);
  });

  it('does not hide other facets that only start with the same letters', () => {
    for (const key of ['flagship', 'flags_extra', 'flagsOther', 'conceptIdsLegacy', 'conceptIds_old', 'xflags', 'flag']) {
      expect(isHiddenSearchFacet(key), key).toBe(false);
    }
  });

  it('follows the same rule for configured keys', () => {
    const policy = createSearchFacetPolicy({ hidden: ['internal'] });

    expect(isHiddenSearchFacet('internal', policy)).toBe(true);
    expect(isHiddenSearchFacet('internal.x', policy)).toBe(true);
    expect(isHiddenSearchFacet('internal_x', policy)).toBe(false);
    expect(isHiddenSearchFacet('internalOther', policy)).toBe(false);
  });
});

describe('parseSearchDocumentTaxonomy', () => {
  it('returns nothing for hits without taxonomy fields', () => {
    expect(parseSearchDocumentTaxonomy({ objectID: 'p1' })).toEqual({});
  });

  it('maps the product type', () => {
    expect(parseSearchDocumentTaxonomy({ productType: { id: 'icecat-cat-8862', name: 'Drills' } })).toEqual({
      productType: { identifier: { key: 'icecat-cat-8862' }, name: 'Drills' },
    });
  });

  it('matches concept names to concept ids within each vocabulary', () => {
    const result = parseSearchDocumentTaxonomy({
      concepts: { features: ['Cordless', 'Outdoor rated'], brands: ['Acme'] },
      conceptIds: ['features/cordless', 'brands/acme', 'features/outdoor-rated'],
    });

    expect(result.concepts).toEqual([
      { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' },
      { identifier: { key: 'brands/acme' }, vocabulary: 'brands', name: 'Acme' },
      { identifier: { key: 'features/outdoor-rated' }, vocabulary: 'features', name: 'Outdoor rated' },
    ]);
  });

  it('pins the pairing contract with the indexer on a realistic hit', () => {
    // conceptIds ascending, ancestors included. Names per vocabulary in ascending concept id order, one per concept.
    // features/outdoor-rated has no translated name, so the indexer wrote its slug.
    const result = parseSearchDocumentTaxonomy({
      conceptIds: [
        'brands/acme',
        'brands/acme-pro',
        'features/outdoor',
        'features/outdoor-rated',
        'features/power',
        'features/power/cordless',
      ],
      concepts: {
        brands: ['Acme', 'Acme Pro'],
        features: ['Outdoor', 'outdoor-rated', 'Power', 'Cordless'],
      },
    });

    expect(result.concepts?.map((t) => [t.identifier.key, t.vocabulary, t.name])).toEqual([
      ['brands/acme', 'brands', 'Acme'],
      ['brands/acme-pro', 'brands', 'Acme Pro'],
      ['features/outdoor', 'features', 'Outdoor'],
      ['features/outdoor-rated', 'features', 'outdoor-rated'],
      ['features/power', 'features', 'Power'],
      ['features/power/cordless', 'features', 'Cordless'],
    ]);
  });

  it('only gives up on the vocabulary whose counts differ', () => {
    const tooMany = parseSearchDocumentTaxonomy({
      conceptIds: ['brands/acme', 'features/a', 'features/b'],
      concepts: { brands: ['Acme', 'Extra'], features: ['A', 'B'] },
    });

    expect(tooMany.concepts?.map((t) => t.name)).toEqual(['acme', 'A', 'B']);
  });

  it('falls back to the id slug when names and ids do not line up', () => {
    const result = parseSearchDocumentTaxonomy({
      concepts: { features: ['Cordless'] },
      conceptIds: ['features/cordless', 'features/outdoor-rated'],
    });

    expect(result.concepts?.map((t) => t.name)).toEqual(['cordless', 'outdoor-rated']);
  });

  it('produces no concepts without concept ids', () => {
    expect(parseSearchDocumentTaxonomy({ concepts: { features: ['Cordless'] } }).concepts).toBeUndefined();
  });

  it('ignores malformed taxonomy fields', () => {
    expect(parseSearchDocumentTaxonomy({ productType: 'x', conceptIds: 3 })).toEqual({});
  });
});

describe('search facet policy', () => {
  it('has the defaults: flags and conceptIds hidden, the product type named, concept facets named after the vocabulary', () => {
    expect(DEFAULT_SEARCH_FACET_POLICY).toEqual({ hidden: ['flags', 'conceptIds'], names: { 'productType.name': 'Product type' } });
    expect(createSearchFacetPolicy()).toEqual(DEFAULT_SEARCH_FACET_POLICY);
    expect(createSearchFacetPolicy({})).toEqual(DEFAULT_SEARCH_FACET_POLICY);
    expect(isHiddenSearchFacet('flags')).toBe(true);
    expect(isHiddenSearchFacet('conceptIds')).toBe(true);
    expect(getTaxonomyFacetName('productType.name')).toBe('Product type');
    expect(getTaxonomyFacetName('concepts.power-source')).toBe('Power Source');
  });

  it('adds hidden facets to the defaults, which stay hidden', () => {
    const policy = createSearchFacetPolicy({ hidden: ['internal', 'flags'] });

    expect(policy.hidden).toEqual(['flags', 'conceptIds', 'internal']);
    expect(isHiddenSearchFacet('internal', policy)).toBe(true);
    expect(isHiddenSearchFacet('flags', policy)).toBe(true);
    expect(isHiddenSearchFacet('conceptIds', policy)).toBe(true);
    expect(isHiddenSearchFacet('brand', policy)).toBe(false);
    // the defaults are not changed by building a policy
    expect(DEFAULT_SEARCH_FACET_POLICY.hidden).toEqual(['flags', 'conceptIds']);
  });

  it('renames facets, a configured name wins over the defaults, other facets have no name', () => {
    const policy = createSearchFacetPolicy({ names: { brand: 'Brand', 'productType.name': 'Kind', 'concepts.features': 'Product features' } });

    expect(getTaxonomyFacetName('brand', policy)).toBe('Brand');
    expect(getTaxonomyFacetName('productType.name', policy)).toBe('Kind');
    expect(getTaxonomyFacetName('concepts.features', policy)).toBe('Product features');
    expect(getTaxonomyFacetName('concepts.campaigns', policy)).toBe('Campaigns');
    expect(getTaxonomyFacetName('colour', policy)).toBeUndefined();
  });

  it('validates the options', () => {
    expect(SearchFacetPolicyOptionsSchema.safeParse({ hidden: ['a'], names: { a: 'A' } }).success).toBe(true);
    expect(SearchFacetPolicyOptionsSchema.safeParse({}).success).toBe(true);
    expect(SearchFacetPolicyOptionsSchema.safeParse({ hidden: 'a' }).success).toBe(false);
    expect(SearchFacetPolicyOptionsSchema.safeParse({ names: { a: 1 } }).success).toBe(false);
  });
});
