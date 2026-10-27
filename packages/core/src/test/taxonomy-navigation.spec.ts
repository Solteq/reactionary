import { describe, expect, it } from 'vitest';
import {
  affinitiesFromSegments,
  affinitiesToSeeds,
  buildConceptIndex,
  expandConcepts,
  findRelatedConcepts,
  scoreItems,
  splitDirectAndBroader,
} from '../utils/taxonomy-navigation.js';
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
