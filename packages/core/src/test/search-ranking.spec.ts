import { describe, expect, it } from 'vitest';
import {
  AffinityRanking,
  DEFAULT_AFFINITY_RANKING_STRENGTH,
  SearchPersonalizationOptionsSchema,
  searchPersonalizationModeOf,
  type AffinityRankableHit,
} from '../utils/search-ranking.js';

const hit = (key: string, ...concepts: string[]): AffinityRankableHit => ({
  identifier: { key },
  concepts: concepts.map((id) => ({ identifier: { key: id } })),
});
const keys = (hits: readonly AffinityRankableHit[]) => hits.map((h) => h.identifier.key);
const page = (...names: string[]) => names.map((name) => hit(name));

describe('AffinityRanking', () => {
  it('keeps the order of the engine for a visitor with no interest, with no profile and with hits that have no concepts', () => {
    const ranking = new AffinityRanking();
    const hits = [hit('a'), hit('b'), hit('c', 'features/cordless')];

    expect(keys(ranking.rank(hits, undefined))).toEqual(['a', 'b', 'c']);
    expect(keys(ranking.rank(hits, { affinities: {} }))).toEqual(['a', 'b', 'c']);
    expect(keys(ranking.rank(page('a', 'b', 'c'), { affinities: { 'features/cordless': 1 } }))).toEqual(['a', 'b', 'c']);
  });

  it('lifts a hit with a concept the visitor is interested in, but not past the best matches', () => {
    const hits = [hit('a'), hit('b'), hit('c'), hit('d'), hit('e'), hit('f'), hit('g'), hit('h', 'features/cordless')];
    const ranked = keys(new AffinityRanking().rank(hits, { affinities: { 'features/cordless': 1 } }));

    expect(ranked.indexOf('h')).toBeLessThan(7);
    expect(ranked.slice(0, 2)).toEqual(['a', 'b']);
  });

  it('lifts a hit more for a stronger interest', () => {
    const hits = [hit('a'), hit('b'), hit('c'), hit('d'), hit('e'), hit('f'), hit('g'), hit('h', 'features/cordless')];
    const weak = keys(new AffinityRanking().rank(hits, { affinities: { 'features/cordless': 0.3 } })).indexOf('h');
    const strong = keys(new AffinityRanking().rank(hits, { affinities: { 'features/cordless': 1 } })).indexOf('h');

    expect(strong).toBeLessThan(weak);
  });

  it('takes the highest weight among the concepts of a hit, so a hit is not counted twice for related concepts', () => {
    const hits = [hit('a'), hit('b', 'application/power-tools', 'application/drilling-fastening'), hit('c', 'application/power-tools')];
    const ranking = new (class extends AffinityRanking {
      public interest(ids: string[], weights: Map<string, number>) {
        return this.interestOf(ids, weights);
      }
    })();

    expect(ranking.interest(['x', 'y'], new Map([['x', 0.3], ['y', 0.6]]))).toBe(0.6);
    expect(keys(ranking.rank(hits, { affinities: { 'application/power-tools': 0.6, 'application/drilling-fastening': 0.6 } })).indexOf('b')).toBe(
      keys(ranking.rank(hits, { affinities: { 'application/power-tools': 0.6 } })).indexOf('b'),
    );
  });

  it('keeps the order of the engine between hits with the same interest', () => {
    const hits = [hit('a'), hit('b', 'x/y'), hit('c', 'x/y')];
    const ranked = keys(new AffinityRanking().rank(hits, { affinities: { 'x/y': 0.6 } }));

    expect(ranked.indexOf('b')).toBeLessThan(ranked.indexOf('c'));
  });

  it('returns every hit once, does not change the list it is given, and ignores malformed weights', () => {
    const hits = [hit('a'), hit('b', 'x/y'), hit('c', 'x/z')];
    const copy = [...hits];
    const ranked = new AffinityRanking().rank(hits, { affinities: { 'x/y': 50, 'x/z': Number.NaN, 'x/w': -1 } });

    expect(hits).toEqual(copy);
    expect(keys(ranked).sort()).toEqual(['a', 'b', 'c']);
  });

  it('clamps the strength to 0..1 and falls back to the default for a value that is not a number', () => {
    const hits = [hit('a'), hit('b'), hit('c', 'x/y')];
    const profile = { affinities: { 'x/y': 1 } };

    expect(keys(new AffinityRanking({ strength: 0 }).rank(hits, profile))).toEqual(['a', 'b', 'c']);
    expect(keys(new AffinityRanking({ strength: 99 }).rank(hits, profile)).sort()).toEqual(['a', 'b', 'c']);
    expect(keys(new AffinityRanking({ strength: Number.NaN }).rank(hits, profile))).toEqual(keys(new AffinityRanking().rank(hits, profile)));
    expect(DEFAULT_AFFINITY_RANKING_STRENGTH).toBe(0.4);
  });

  it('lets a subclass change a step: the base relevance from a score of the engine', () => {
    class ByScore extends AffinityRanking {
      protected override baseRelevanceOf(h: AffinityRankableHit): number {
        return (h as AffinityRankableHit & { score: number }).score;
      }
    }
    const hits = [
      { ...hit('a'), score: 1 },
      { ...hit('b', 'x/y'), score: 0.9 },
      { ...hit('c'), score: 0.2 },
    ];

    expect(keys(new ByScore({ strength: 1 }).rank(hits, { affinities: { 'x/y': 1 } }))).toEqual(['b', 'a', 'c']);
    expect(keys(new ByScore({ strength: 0 }).rank(hits, { affinities: { 'x/y': 1 } }))).toEqual(['a', 'b', 'c']);
  });
});

describe('SearchPersonalizationOptions', () => {
  it('defaults to the engine, accepts the three modes and refuses others', () => {
    expect(searchPersonalizationModeOf(undefined)).toBe('engine');
    expect(searchPersonalizationModeOf({})).toBe('engine');
    expect(searchPersonalizationModeOf({ mode: 'affinity' })).toBe('affinity');
    expect(SearchPersonalizationOptionsSchema.safeParse({ mode: 'none', strength: 0.2 }).success).toBe(true);
    expect(SearchPersonalizationOptionsSchema.safeParse({ mode: 'cohere' }).success).toBe(false);
    expect(SearchPersonalizationOptionsSchema.safeParse({ strength: 2 }).success).toBe(false);
  });
});
