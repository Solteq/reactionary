import { describe, expect, it } from 'vitest';
import { getTaxonomyFacetName, getTermFacetName, isHiddenSearchFacet, parseSearchDocumentTaxonomy } from '../utils/search-taxonomy.js';

describe('getTermFacetName', () => {
  it('names a term facet after its title-cased vocabulary', () => {
    expect(getTermFacetName('terms.features')).toBe('Features');
    expect(getTermFacetName('terms.power-source')).toBe('Power Source');
    expect(getTermFacetName('terms.use_case')).toBe('Use Case');
  });

  it('ignores facets that are no term facets', () => {
    expect(getTermFacetName('termIds')).toBeUndefined();
    expect(getTermFacetName('terms.')).toBeUndefined();
    expect(getTermFacetName('brand')).toBeUndefined();
  });
});

describe('getTaxonomyFacetName', () => {
  it('names the product type facet and term facets', () => {
    expect(getTaxonomyFacetName('productType.name')).toBe('Product type');
    expect(getTaxonomyFacetName('terms.features')).toBe('Features');
    expect(getTaxonomyFacetName('brand')).toBeUndefined();
  });
});

describe('isHiddenSearchFacet', () => {
  it('hides every facet starting with flags or termIds', () => {
    expect(isHiddenSearchFacet('flags')).toBe(true);
    expect(isHiddenSearchFacet('flags.value')).toBe(true);
    expect(isHiddenSearchFacet('termIds')).toBe(true);
    expect(isHiddenSearchFacet('terms.features')).toBe(false);
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

  it('matches term names to term ids within each vocabulary', () => {
    const result = parseSearchDocumentTaxonomy({
      terms: { features: ['Cordless', 'Outdoor rated'], brands: ['Acme'] },
      termIds: ['features/cordless', 'brands/acme', 'features/outdoor-rated'],
    });

    expect(result.terms).toEqual([
      { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' },
      { identifier: { key: 'brands/acme' }, vocabulary: 'brands', name: 'Acme' },
      { identifier: { key: 'features/outdoor-rated' }, vocabulary: 'features', name: 'Outdoor rated' },
    ]);
  });

  it('falls back to the id slug when names and ids do not line up', () => {
    const result = parseSearchDocumentTaxonomy({
      terms: { features: ['Cordless'] },
      termIds: ['features/cordless', 'features/outdoor-rated'],
    });

    expect(result.terms?.map((t) => t.name)).toEqual(['cordless', 'outdoor-rated']);
  });

  it('produces no terms without term ids', () => {
    expect(parseSearchDocumentTaxonomy({ terms: { features: ['Cordless'] } }).terms).toBeUndefined();
  });

  it('ignores malformed taxonomy fields', () => {
    expect(parseSearchDocumentTaxonomy({ productType: 'x', termIds: 3 })).toEqual({});
  });
});
