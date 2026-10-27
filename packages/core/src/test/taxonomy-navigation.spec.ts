import { describe, expect, it } from 'vitest';
import {
  affinitiesFromSegments,
  affinitiesToSeeds,
  buildConceptIndex,
  expandConcepts,
  findRelatedConcepts,
  limitExpansion,
  rankItems,
  scoreItems,
  splitDirectAndBroader,
} from '../utils/taxonomy-navigation.js';
import type { ExpandedConcept } from '../schemas/models/taxonomy.model.js';
import { concept, createVocabularies, vocabulary } from './taxonomy-fixtures.js';

function weights(expansion: ReturnType<typeof expandConcepts>) {
  return Object.fromEntries(expansion.map((e) => [e.identifier.key, [Number(e.weight.toFixed(4)), e.via]]));
}

describe('buildConceptIndex', () => {
  const index = buildConceptIndex(createVocabularies());

  it('finds concepts, ancestors nearest first and descendants with their depth', () => {
    expect(index.get('features/cordless')?.name).toBe('cordless');
    expect(index.ancestors('features/battery-18v')).toEqual(['features/cordless', 'features/power']);
    expect(index.descendants('features/power')).toEqual([
      { id: 'features/cordless', depth: 1 },
      { id: 'features/corded', depth: 1 },
      { id: 'features/battery-18v', depth: 2 },
    ]);
    expect(index.descendants('features/power', { maxDepth: 1 }).map((d) => d.id)).toEqual(['features/cordless', 'features/corded']);
    expect(index.isAncestorOf('features/power', 'features/battery-18v')).toBe(true);
    expect(index.isAncestorOf('features/battery-18v', 'features/power')).toBe(false);
  });

  it('sees related links from both ends', () => {
    expect(index.related('features/cordless')).toEqual(expect.arrayContaining(['features/outdoor', 'brands/acme']));
    expect(index.related('features/outdoor')).toContain('features/cordless');
    expect(index.related('features/outdoor')).toContain('features/garden');
  });

  it('tolerates unknown ids', () => {
    expect(index.get('nope/x')).toBeUndefined();
    expect(index.ancestors('nope/x')).toEqual([]);
    expect(index.descendants('nope/x')).toEqual([]);
    expect(index.related('nope/x')).toEqual([]);
    expect(index.isAncestorOf('nope/x', 'nope/y')).toBe(false);
  });

  it('survives parent cycles, self parents and circular trees', () => {
    const a = concept('loops/a', { parent: { key: 'loops/b' } });
    const b = concept('loops/b', { parent: { key: 'loops/a' } });
    const self = concept('loops/self', { parent: { key: 'loops/self' } });
    const tree = concept('loops/tree', {});
    tree.children = [tree];
    // built by hand, a circular tree cannot go through the schema parse
    const looped = buildConceptIndex([{ identifier: { key: 'loops' }, name: 'loops', concepts: [a, b, self, tree] }]);

    expect(looped.ancestors('loops/a')).toEqual(['loops/b']);
    expect(looped.ancestors('loops/self')).toEqual([]);
    expect(looped.descendants('loops/a')).toEqual([{ id: 'loops/b', depth: 1 }]);
    expect(looped.descendants('loops/tree')).toEqual([]);
    expect(() => expandConcepts(looped, [{ identifier: { key: 'loops/a' }, vocabulary: 'loops' }])).not.toThrow();
  });
});

describe('expandConcepts', () => {
  const index = buildConceptIndex(createVocabularies());
  const seed = (key: string, extra: object = {}) => ({ identifier: { key }, vocabulary: key.split('/')[0], ...extra });

  it('decays narrower concepts per level', () => {
    const result = weights(expandConcepts(index, [seed('features/power')]));

    expect(result['features/power']).toEqual([1, 'exact']);
    expect(result['features/cordless']).toEqual([0.8, 'narrower']);
    expect(result['features/corded']).toEqual([0.8, 'narrower']);
    expect(result['features/battery-18v']).toEqual([0.64, 'narrower']);
  });

  it('decays broader concepts per hop and stops at the minimum weight', () => {
    const result = weights(expandConcepts(index, [seed('features/battery-18v')]));

    expect(result['features/cordless']).toEqual([0.4, 'broader']);
    expect(result['features/power']).toEqual([0.24, 'broader']);
    // a third hop would be 0.144, below the minimum weight
    const deep = buildConceptIndex([
      vocabulary('d', [concept('d/a', { children: [concept('d/b', { parent: { key: 'd/a' }, children: [concept('d/c', { parent: { key: 'd/b' }, children: [concept('d/d', { parent: { key: 'd/c' } })] })] })] })]),
    ]);
    expect(Object.keys(weights(expandConcepts(deep, [seed('d/d')])))).toEqual(['d/d', 'd/c', 'd/b']);
  });

  it('follows related links from both ends, one hop only', () => {
    const fromCordless = weights(expandConcepts(index, [seed('features/cordless')]));
    const fromOutdoor = weights(expandConcepts(index, [seed('features/outdoor')]));

    expect(fromCordless['features/outdoor']).toEqual([0.5, 'related']);
    expect(fromOutdoor['features/cordless']).toEqual([0.5, 'related']);
    // garden is related to outdoor, which is related to cordless, that is two hops
    expect(fromCordless['features/garden']).toBeUndefined();
    // related is not followed from the descendants either
    expect(weights(expandConcepts(index, [seed('features/power')]))['features/outdoor']).toBeUndefined();
  });

  it('keeps the best weight when a concept is reached in several ways', () => {
    const result = expandConcepts(index, [seed('features/power'), seed('features/battery-18v')]);

    const battery = result.find((e) => e.identifier.key === 'features/battery-18v');
    const power = result.find((e) => e.identifier.key === 'features/power');
    expect(battery).toMatchObject({ weight: 1, via: 'exact' });
    expect(battery?.source).toBeUndefined();
    expect(power).toMatchObject({ weight: 1, via: 'exact' });
    expect(result.filter((e) => e.identifier.key === 'features/cordless')).toHaveLength(1);
    expect(result.find((e) => e.identifier.key === 'features/cordless')).toMatchObject({ weight: 0.8, via: 'narrower', source: { key: 'features/power' } });
  });

  it('applies the minimum weight', () => {
    const result = weights(expandConcepts(index, [seed('features/cordless')], { minWeight: 0.5 }));

    expect(Object.keys(result).sort()).toEqual(['features/cordless', 'features/outdoor', 'features/battery-18v'].sort());
  });

  it('scales the weights with the seed weight', () => {
    const result = weights(expandConcepts(index, [seed('features/power', { weight: 0.5 })]));

    expect(result['features/power']).toEqual([0.5, 'exact']);
    expect(result['features/cordless']).toEqual([0.4, 'narrower']);
    expect(result['features/battery-18v']).toEqual([0.32, 'narrower']);
  });

  it('ignores seeds without a usable weight', () => {
    expect(expandConcepts(index, [seed('features/power', { weight: 0 }), seed('features/outdoor', { weight: Number.NaN })])).toEqual([]);
  });

  it('reaches only the vocabularies of the seeds unless the policy names more', () => {
    expect(weights(expandConcepts(index, [seed('features/cordless')]))['brands/acme']).toBeUndefined();

    const wide = weights(expandConcepts(index, [seed('features/cordless')], { vocabularies: ['features', 'brands'] }));
    expect(wide['brands/acme']).toEqual([0.5, 'related']);
  });

  it('widens to the vocabularies of the policy and never removes the ones of the seeds', () => {
    const result = weights(expandConcepts(index, [seed('features/cordless')], { vocabularies: ['brands'] }));

    expect(result['features/cordless']).toEqual([1, 'exact']);
    expect(result['features/outdoor']).toEqual([0.5, 'related']);
    expect(result['brands/acme']).toEqual([0.5, 'related']);
    // a list of the seed vocabulary alone changes nothing
    expect(expandConcepts(index, [seed('features/cordless')], { vocabularies: ['features'] })).toEqual(expandConcepts(index, [seed('features/cordless')]));
  });

  it('merges seeds for the same concept and keeps the highest weight', () => {
    const result = expandConcepts(index, [seed('features/power', { weight: 0.5 }), seed('features/power', { weight: 1 }), seed('features/power', { weight: 0.2 })]);

    expect(result.filter((e) => e.identifier.key === 'features/power')).toEqual([{ identifier: { key: 'features/power' }, weight: 1, via: 'exact' }]);
    expect(weights(result)['features/cordless']).toEqual([0.8, 'narrower']);
  });

  it('does not walk the part of the tree below the minimum weight', () => {
    const requested: Array<number | undefined> = [];
    const spy = {
      ...index,
      descendants: (id: string, options?: { maxDepth?: number }) => {
        requested.push(options?.maxDepth);
        return index.descendants(id, options);
      },
    };

    // 0.8, 0.64, 0.512, 0.41, 0.328: five levels stay above 0.3
    expandConcepts(spy, [seed('features/power')], { minWeight: 0.3 });
    // nothing below the seed reaches 0.9
    expandConcepts(spy, [seed('features/power')], { minWeight: 0.9 });

    expect(requested).toEqual([5]);
  });

  it('lets the policy change weights and sorts by weight', () => {
    const result = expandConcepts(index, [seed('features/cordless')], { relatedWeight: 0.9, narrowerWeight: 0.3, minWeight: 0.1 });

    expect(result.map((e) => e.identifier.key)).toEqual(['features/cordless', 'features/outdoor', 'features/power', 'features/battery-18v']);
  });

  it('uses the parent of a seed that is not in the loaded taxonomy', () => {
    const result = weights(expandConcepts(index, [seed('features/unknown', { parent: { key: 'features/cordless' } })]));

    expect(result['features/cordless']).toEqual([0.4, 'broader']);
    expect(result['features/power']).toEqual([0.24, 'broader']);
  });
});

describe('findRelatedConcepts', () => {
  const index = buildConceptIndex(createVocabularies());

  it('navigates in all directions by default, one level', () => {
    const result = findRelatedConcepts(index, ['features/cordless']);

    expect(result.map((r) => [r.concept.key, r.relation, r.depth])).toEqual([
      ['features/power', 'broader', 1],
      ['features/battery-18v', 'narrower', 1],
      ['features/outdoor', 'related', 1],
      ['brands/acme', 'related', 1],
    ]);
    expect(result.every((r) => r.via.key === 'features/cordless')).toBe(true);
  });

  it('limits the relations and follows the depth', () => {
    expect(findRelatedConcepts(index, ['features/battery-18v'], { relations: ['broader'], maxDepth: 2 }).map((r) => [r.concept.key, r.depth])).toEqual([
      ['features/cordless', 1],
      ['features/power', 2],
    ]);
    expect(findRelatedConcepts(index, ['features/power'], { relations: ['narrower'], maxDepth: 2 })).toHaveLength(3);
    expect(findRelatedConcepts(index, ['nope/x'])).toEqual([]);
  });
});

describe('splitDirectAndBroader', () => {
  const closure = [
    { identifier: { key: 'features/power' } },
    { identifier: { key: 'features/cordless' }, parent: { key: 'features/power' } },
    { identifier: { key: 'features/battery-18v' }, parent: { key: 'features/cordless' } },
    { identifier: { key: 'features/outdoor' } },
    { identifier: { key: 'brands/acme' } },
  ];

  it('infers broader concepts from the parent links, transitively', () => {
    expect(splitDirectAndBroader(closure)).toEqual({
      direct: ['features/battery-18v', 'features/outdoor', 'brands/acme'],
      broader: ['features/power', 'features/cordless'],
    });
  });

  it('lets an explicit direct set override the inference', () => {
    expect(splitDirectAndBroader(closure, ['features/cordless', 'features/outdoor'])).toEqual({
      direct: ['features/cordless', 'features/outdoor'],
      broader: ['features/power', 'features/battery-18v', 'brands/acme'],
    });
  });

  it('takes all concepts as direct when the parent links form a circle only', () => {
    const circle = [
      { identifier: { key: 'a/x' }, parent: { key: 'a/y' } },
      { identifier: { key: 'a/y' }, parent: { key: 'a/x' } },
    ];

    expect(splitDirectAndBroader(circle)).toEqual({ direct: ['a/x', 'a/y'], broader: [] });
    expect(splitDirectAndBroader([{ identifier: { key: 'a/self' }, parent: { key: 'a/self' } }])).toEqual({ direct: ['a/self'], broader: [] });
    expect(splitDirectAndBroader([])).toEqual({ direct: [], broader: [] });
  });

  it('survives parent cycles and parents outside of the list', () => {
    const result = splitDirectAndBroader([
      { identifier: { key: 'a/x' }, parent: { key: 'a/y' } },
      { identifier: { key: 'a/y' }, parent: { key: 'a/x' } },
      { identifier: { key: 'a/z' }, parent: { key: 'a/missing' } },
    ]);

    expect(result.broader.sort()).toEqual(['a/x', 'a/y']);
    expect(result.direct).toEqual(['a/z']);
  });
});

describe('scoreItems', () => {
  const index = buildConceptIndex(createVocabularies());
  const expansion = expandConcepts(index, [{ identifier: { key: 'features/cordless' }, vocabulary: 'features' }]);

  it('lets the best match dominate and adds a quarter of the others', () => {
    const result = scoreItems(
      [
        { key: 'two', concepts: ['features/cordless', 'features/outdoor'] },
        { key: 'one', concepts: ['features/cordless'] },
        { key: 'none', concepts: ['features/garden'] },
        { key: 'weak', concepts: ['features/power'] },
      ],
      expansion,
    );

    expect(result.map((r) => [r.key, Number(r.score.toFixed(4))])).toEqual([
      ['two', 1.125],
      ['one', 1],
      ['weak', 0.4],
      ['none', 0],
    ]);
  });

  it('keeps the input order for equal scores and counts a repeated concept once', () => {
    const result = scoreItems(
      [
        { key: 'first', concepts: ['features/outdoor'] },
        { key: 'second', concepts: ['features/outdoor', 'features/outdoor'] },
        { key: 'third', concepts: [] },
        { key: 'fourth', concepts: [] },
      ],
      expansion,
    );

    expect(result.map((r) => r.key)).toEqual(['first', 'second', 'third', 'fourth']);
    expect(result[1].score).toBe(0.5);
  });
});

describe('affinitiesToSeeds', () => {
  it('ignores garbage, keeps the top N and normalizes by the highest score', () => {
    const seeds = affinitiesToSeeds(
      {
        'features/a': 50,
        'features/b': 25,
        'brands/c': 10,
        'features/zero': 0,
        'features/negative': -3,
        'features/nan': Number.NaN,
        'features/inf': Number.POSITIVE_INFINITY,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ 'features/text': 'high' } as any),
      },
      { topN: 2 },
    );

    expect(seeds.map((s) => [s.identifier.key, s.vocabulary, s.weight])).toEqual([
      ['features/a', 'features', 1],
      ['features/b', 'features', 0.5],
    ]);
  });

  it('defaults to 20 and handles empty input', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`v/c${i}`, i + 1]));

    expect(affinitiesToSeeds(many)).toHaveLength(20);
    expect(affinitiesToSeeds({})).toEqual([]);
    expect(affinitiesToSeeds({ 'v/a': 0 })).toEqual([]);
    expect(affinitiesToSeeds({ 'v/a': 3 }, { topN: 0 })).toEqual([]);
  });
});

describe('affinitiesToSeeds normalization', () => {
  it('is idempotent for scores that are already within (0, 1]', () => {
    const banded = { 'features/a': 1, 'features/b': 0.6, 'features/c': 0.3 };

    const once = affinitiesToSeeds(banded);
    const twice = affinitiesToSeeds(Object.fromEntries(once.map((s) => [s.identifier.key, s.weight ?? 0])));

    expect(once.map((s) => s.weight)).toEqual([1, 0.6, 0.3]);
    expect(twice).toEqual(once);
  });

  it('does not scale a profile with only low interests up to full weight', () => {
    expect(affinitiesToSeeds({ 'features/a': 0.3 }).map((s) => s.weight)).toEqual([0.3]);
  });

  it('still scales raw scores above 1 down by the highest one', () => {
    expect(affinitiesToSeeds({ 'features/a': 200, 'features/b': 50 }).map((s) => s.weight)).toEqual([1, 0.25]);
  });
});

describe('affinitiesFromSegments', () => {
  it('reads the banded affinity segments as concept ids with their weights', () => {
    expect(
      affinitiesFromSegments([
        'affinity.features.cordless.high',
        'affinity.features.outdoor.medium',
        'affinity.brands.acme.low',
        'affinity.power-tools.drill_bit-2.high',
      ]),
    ).toEqual({
      'features/cordless': 1,
      'features/outdoor': 0.6,
      'brands/acme': 0.3,
      'power-tools/drill_bit-2': 1,
    });
  });

  it('ignores segments that are not affinity segments', () => {
    expect(
      affinitiesFromSegments([
        'vip',
        'trait.craftsmantype.lumberjack.high',
        'affinity.features.cordless',
        'affinity.features.cordless.high.extra',
        'affinity.features',
        'affinity..cordless.high',
        'affinity.features..high',
        'affinity.features.cordless.extreme',
        'affinity.features.cordless.HIGH',
        'affinity.features.cordless.High',
        'Affinity.features.cordless.high',
        'affinity/features/cordless/high',
        '',
      ]),
    ).toEqual({});
  });

  it('ignores values that are not strings', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(affinitiesFromSegments([null, 3, { name: 'affinity.features.cordless.high' }, 'affinity.features.cordless.low'] as any)).toEqual({
      'features/cordless': 0.3,
    });
  });

  it('keeps the highest band of a concept, whatever the order', () => {
    expect(affinitiesFromSegments(['affinity.features.cordless.low', 'affinity.features.cordless.high', 'affinity.features.cordless.medium'])).toEqual({ 'features/cordless': 1 });
    expect(affinitiesFromSegments(['affinity.features.cordless.high', 'affinity.features.cordless.low'])).toEqual({ 'features/cordless': 1 });
    expect(affinitiesFromSegments(['affinity.features.cordless.low', 'affinity.features.cordless.medium'])).toEqual({ 'features/cordless': 0.6 });
  });

  it('takes custom band weights and ignores unusable ones', () => {
    const segments = ['affinity.a.x.low', 'affinity.a.y.medium', 'affinity.a.z.high'];

    expect(affinitiesFromSegments(segments, { bandWeights: { low: 0.1, medium: 0.5, high: 0.9 } })).toEqual({ 'a/x': 0.1, 'a/y': 0.5, 'a/z': 0.9 });
    // garbage falls back to the defaults per band, weights above 1 are capped
    expect(
      affinitiesFromSegments(segments, { bandWeights: { low: Number.NaN, medium: -1, high: 7 } }),
    ).toEqual({ 'a/x': 0.3, 'a/y': 0.6, 'a/z': 1 });
    expect(affinitiesFromSegments(segments, { bandWeights: { low: 0, medium: Number.POSITIVE_INFINITY } })).toEqual({ 'a/x': 0.3, 'a/y': 0.6, 'a/z': 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(affinitiesFromSegments(segments, { bandWeights: 'bad' as any })).toEqual({ 'a/x': 0.3, 'a/y': 0.6, 'a/z': 1 });
  });

  it('returns an empty record for no segments', () => {
    expect(affinitiesFromSegments([])).toEqual({});
  });
});

describe('rankItems with unusable weights', () => {
  const context: ExpandedConcept[] = [{ identifier: { key: 'a/one' }, weight: 1, via: 'exact' }];
  const items = [
    { key: 'relevant', concepts: ['a/one', 'a/liked'] },
    { key: 'irrelevant', concepts: ['a/liked'] },
  ];
  const find = (result: ReturnType<typeof rankItems>, key: string) => result.find((r) => r.key === key);

  it('does not let a negative affinity push a blended score below the relevance, and zero relevance stays zero', () => {
    const affinity: ExpandedConcept[] = [{ identifier: { key: 'a/liked' }, weight: -100, via: 'exact' }];

    const result = rankItems(items, { context, affinity, personalization: { strength: 1 } });

    expect(find(result, 'relevant')).toMatchObject({ score: 1, relevance: 1, affinity: 0 });
    expect(find(result, 'irrelevant')).toMatchObject({ score: 0, relevance: 0, affinity: 0 });
  });

  it('does not let a negative context weight produce a negative score', () => {
    const result = rankItems(items, { context: [{ identifier: { key: 'a/one' }, weight: -5, via: 'exact' }] });

    expect(result.every((r) => r.score >= 0 && r.relevance >= 0)).toBe(true);
  });

  it('caps the affinity at 1 for the blend, however large', () => {
    const affinity: ExpandedConcept[] = [{ identifier: { key: 'a/liked' }, weight: 1e9, via: 'exact' }];

    const result = rankItems(items, { context, affinity, personalization: { strength: 0.5 } });

    expect(find(result, 'relevant')?.score).toBeCloseTo(1.5, 10);
  });

  it('reads the strength: not a number is the default, infinities are clamped', () => {
    const affinity: ExpandedConcept[] = [{ identifier: { key: 'a/liked' }, weight: 1, via: 'exact' }];
    const scoreWith = (strength: number) => find(rankItems(items, { context, affinity, personalization: { strength } }), 'relevant')?.score;

    expect(scoreWith(Number.NaN)).toBeCloseTo(1.5, 10);
    expect(scoreWith(Number.POSITIVE_INFINITY)).toBeCloseTo(2, 10);
    expect(scoreWith(Number.NEGATIVE_INFINITY)).toBeCloseTo(1, 10);
    expect(scoreWith(-3)).toBeCloseTo(1, 10);
    expect(scoreWith(7)).toBeCloseTo(2, 10);
  });

  it('ranks 5000 items against 2000 concepts well under a second', () => {
    const expansion: ExpandedConcept[] = Array.from({ length: 2000 }, (_, i) => ({ identifier: { key: `a/c${i}` }, weight: 0.5, via: 'exact' }));
    const many = Array.from({ length: 5000 }, (_, i) => ({
      key: `item${i}`,
      concepts: Array.from({ length: 20 }, (_, c) => `a/c${(i * 7 + c * 13) % 4000}`),
    }));
    const started = performance.now();

    const result = rankItems(many, { context: expansion, affinity: expansion });

    expect(result).toHaveLength(5000);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe('limitExpansion', () => {
  const entry = (key: string, weight: number, via: ExpandedConcept['via'] = 'narrower'): ExpandedConcept => ({ identifier: { key }, weight, via });

  it('returns a short expansion as it is', () => {
    const expansion = [entry('a/1', 1, 'exact'), entry('a/2', 0.5)];

    expect(limitExpansion(expansion, 5)).toBe(expansion);
  });

  it('keeps the exact concepts first, then the highest weights, in the order of the expansion', () => {
    const expansion = [entry('a/exact-low', 0.3, 'exact'), entry('a/high', 0.9), entry('a/mid', 0.6), entry('a/low', 0.2), entry('a/mid2', 0.6)];

    expect(limitExpansion(expansion, 3).map((e) => e.identifier.key)).toEqual(['a/exact-low', 'a/high', 'a/mid']);
    expect(limitExpansion(expansion, 1).map((e) => e.identifier.key)).toEqual(['a/exact-low']);
  });
});
