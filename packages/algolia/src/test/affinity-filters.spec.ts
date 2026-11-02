import { describe, expect, it } from 'vitest';
import { affinityOptionalFilters, MAX_AFFINITY_FILTERS } from '../core/affinity-filters.js';

describe('affinityOptionalFilters', () => {
  it('has no filters without a profile or interests', () => {
    expect(affinityOptionalFilters(undefined)).toEqual([]);
    expect(affinityOptionalFilters({ affinities: {} })).toEqual([]);
  });

  it('scores a strong interest 10 and a some interest 6', () => {
    expect(affinityOptionalFilters({ affinities: { 'features/cordless': 1, 'application/power-tools': 0.6 } })).toEqual([
      'conceptIds:features/cordless<score=10>',
      'conceptIds:application/power-tools<score=6>',
    ]);
  });

  it('leaves the low interests out', () => {
    expect(affinityOptionalFilters({ affinities: { 'trade/carpenter': 0.3, 'features/cordless': 1 } })).toEqual(['conceptIds:features/cordless<score=10>']);
  });

  it('puts the strongest first, and orders equal interests by concept id', () => {
    expect(affinityOptionalFilters({ affinities: { 'features/b': 1, 'features/a': 1, 'features/c': 0.6 } })).toEqual([
      'conceptIds:features/a<score=10>',
      'conceptIds:features/b<score=10>',
      'conceptIds:features/c<score=6>',
    ]);
  });

  it('gives the same filters whatever order the interests come in', () => {
    const forwards = { 'features/a': 1, 'features/b': 0.6, 'features/c': 1 };
    const backwards = { 'features/c': 1, 'features/b': 0.6, 'features/a': 1 };
    expect(affinityOptionalFilters({ affinities: forwards })).toEqual(affinityOptionalFilters({ affinities: backwards }));
  });

  it('keeps at most five concepts', () => {
    const affinities = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((slug) => [`features/${slug}`, 1]));
    const filters = affinityOptionalFilters({ affinities });

    expect(filters).toHaveLength(MAX_AFFINITY_FILTERS);
    expect(filters[MAX_AFFINITY_FILTERS - 1]).toBe('conceptIds:features/e<score=10>');
  });

  it('caps a weight above 1, and leaves out what is not a number or not a concept id', () => {
    expect(
      affinityOptionalFilters({
        affinities: { 'features/a': 3, 'features/b': Number.NaN, 'Features/c': 1, 'features/d e': 1, 'features/f<score=99>': 1, plain: 1 },
      }),
    ).toEqual(['conceptIds:features/a<score=10>']);
  });
});
