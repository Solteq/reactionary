import { assert, describe, expect, it } from 'vitest';
import { MemoryCache } from '../cache/memory-cache.js';
import { NoOpCache } from '../cache/noop-cache.js';
import type { Cache } from '../cache/cache.interface.js';
import { TaxonomyCapability } from '../capabilities/taxonomy.capability.js';
import { createInitialRequestContext } from '../initialization.js';
import type { NotFoundError } from '../schemas/errors/not-found.error.js';
import type { Concept, ConceptRankedItem, ExpandedConcept, Vocabulary } from '../schemas/models/taxonomy.model.js';
import type { TaxonomyQueryGetConcepts, TaxonomyQueryGetRelatedConcepts, TaxonomyQueryGetVocabulary } from '../schemas/queries/taxonomy.query.js';
import { error, success, type Result } from '../schemas/result.js';
import { affinitiesFromSegments } from '../utils/taxonomy-navigation.js';
import { concept, createVocabularies, vocabulary } from './taxonomy-fixtures.js';

class StubTaxonomyCapability extends TaxonomyCapability {
  public requested: string[] = [];

  constructor(
    cache: Cache = new NoOpCache(),
    protected vocabularies: Vocabulary[] = createVocabularies(),
    protected failWith?: { type: string; message?: string },
  ) {
    super(cache, createInitialRequestContext());
  }

  public override async getVocabulary(payload: TaxonomyQueryGetVocabulary): Promise<Result<Vocabulary, NotFoundError>> {
    this.requested.push(payload.vocabulary.key);
    if (this.failWith) {
      return error<{ type: 'Generic'; message: string }>({ type: 'Generic', message: this.failWith.message ?? 'boom' });
    }
    const vocabulary = this.vocabularies.find((v) => v.identifier.key === payload.vocabulary.key);
    return vocabulary ? success(vocabulary) : error<NotFoundError>({ type: 'NotFound', identifier: payload.vocabulary });
  }

  public override async getConcepts(_payload: TaxonomyQueryGetConcepts): Promise<Result<Concept[]>> {
    return success([]);
  }
}

const cordlessSeed = { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'cordless' };

function keys(expansion: ExpandedConcept[]) {
  return expansion.map((e) => e.identifier.key);
}

async function expanded(capability: TaxonomyCapability, key: string): Promise<ExpandedConcept[]> {
  const result = await capability.expandConcepts({ concepts: [{ identifier: { key }, vocabulary: key.split('/')[0], name: key }] });
  if (!result.success) {
    assert.fail();
  }
  return result.value;
}

describe('TaxonomyCapability.expandConcepts', () => {
  it('loads only the vocabularies of the concepts and expands them sorted by weight', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({ concepts: [cordlessSeed] });

    if (!result.success) {
      assert.fail();
    }
    expect(capability.requested).toEqual(['features']);
    expect(keys(result.value)).toEqual(['features/cordless', 'features/battery-18v', 'features/outdoor', 'features/power']);
    expect(result.value.map((e) => e.via)).toEqual(['exact', 'narrower', 'related', 'broader']);
  });

  it('loads the vocabularies the policy names as well', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({ concepts: [cordlessSeed], policy: { vocabularies: ['features', 'brands'] } });

    if (!result.success) {
      assert.fail();
    }
    expect(capability.requested.sort()).toEqual(['brands', 'features']);
    expect(keys(result.value)).toContain('brands/acme');
  });

  it('skips a vocabulary the provider does not know', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({
      concepts: [{ identifier: { key: 'gone/x' }, vocabulary: 'gone', name: 'x' }],
    });

    if (!result.success) {
      assert.fail();
    }
    expect(keys(result.value)).toEqual(['gone/x']);
  });

  it('passes a failing getVocabulary on as a failure', async () => {
    const capability = new StubTaxonomyCapability(new NoOpCache(), [], { type: 'Generic', message: 'Taxonomy is not supported' });

    const result = await capability.expandConcepts({ concepts: [cordlessSeed] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'Generic', message: 'Taxonomy is not supported' });
    }
    expect((await capability.getRelatedConcepts({ concepts: [{ key: 'features/cordless' }] })).success).toBe(false);
    expect((await capability.expandAffinities({ affinities: { 'features/cordless': 1 } })).success).toBe(false);
  });

  it('does not cache, so every call loads the vocabularies through the provider', async () => {
    const capability = new StubTaxonomyCapability(new MemoryCache());

    const first = await capability.expandConcepts({ concepts: [cordlessSeed] });
    const second = await capability.expandConcepts({ concepts: [cordlessSeed] });

    if (!first.success || !second.success) {
      assert.fail();
    }
    expect(first.meta.cache.hit).toBe(false);
    expect(second.meta.cache.hit).toBe(false);
    expect(capability.requested).toEqual(['features', 'features']);
  });

  it('takes the default policy from a hook that subclasses can override, and the call wins', async () => {
    class Tuned extends StubTaxonomyCapability {
      protected override defaultExpansionPolicy() {
        return { relatedWeight: 0.9, minWeight: 0.5 };
      }
    }
    const capability = new Tuned();

    const tuned = await capability.expandConcepts({ concepts: [cordlessSeed] });
    const overridden = await capability.expandConcepts({ concepts: [cordlessSeed], policy: { relatedWeight: 0.6, minWeight: 0.1 } });

    if (!tuned.success || !overridden.success) {
      assert.fail();
    }
    expect(tuned.value.find((e) => e.identifier.key === 'features/outdoor')?.weight).toBe(0.9);
    // the broader concept power gets 0.4, below the minimum weight of the hook
    expect(keys(tuned.value)).not.toContain('features/power');
    // the policy of the call replaces the values of the hook
    expect(overridden.value.find((e) => e.identifier.key === 'features/outdoor')?.weight).toBe(0.6);
    expect(keys(overridden.value)).toContain('features/power');
  });

  it('honours the policy hook of each subclass when they share a cache', async () => {
    class Loose extends StubTaxonomyCapability {
      protected override defaultExpansionPolicy() {
        return { relatedWeight: 0.9 };
      }
    }
    class Strict extends StubTaxonomyCapability {
      protected override defaultExpansionPolicy() {
        return { relatedWeight: 0.2, minWeight: 0.5 };
      }
    }
    const cache = new MemoryCache();
    const payload = { concepts: [cordlessSeed] };

    const loose = await new Loose(cache).expandConcepts(payload);
    const strict = await new Strict(cache).expandConcepts(payload);
    const looseRelated = await new Loose(cache).getRelatedConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!loose.success || !strict.success || !looseRelated.success) {
      assert.fail();
    }
    expect(loose.value.find((e) => e.identifier.key === 'features/outdoor')?.weight).toBe(0.9);
    expect(keys(strict.value)).not.toContain('features/outdoor');
    expect(looseRelated.meta.cache.hit).toBe(false);
  });

  it('rejects an invalid payload', async () => {
    const capability = new StubTaxonomyCapability();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await capability.expandConcepts({ concepts: 'features/cordless' } as any);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });
});

describe('TaxonomyCapability.getRelatedConcepts', () => {
  it('navigates from concepts, loading their vocabularies', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.getRelatedConcepts({ concepts: [{ key: 'features/cordless' }], relations: ['broader', 'narrower'] });

    if (!result.success) {
      assert.fail();
    }
    expect(capability.requested).toEqual(['features']);
    expect(result.value.map((r) => [r.concept.key, r.relation, r.depth])).toEqual([
      ['features/power', 'broader', 1],
      ['features/battery-18v', 'narrower', 1],
    ]);
  });

  it('can be replaced by a subclass', async () => {
    class Custom extends StubTaxonomyCapability {
      public override async getRelatedConcepts(_payload: TaxonomyQueryGetRelatedConcepts) {
        return success([{ concept: { key: 'custom/one' }, relation: 'related' as const, depth: 1, via: { key: 'custom/start' } }]);
      }
    }

    const result = await new Custom().getRelatedConcepts({ concepts: [{ key: 'features/cordless' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((r) => r.concept.key)).toEqual(['custom/one']);
  });
});

describe('TaxonomyCapability.expandAffinities', () => {
  it('seeds the expansion with the banded affinities and is not cached', async () => {
    const capability = new StubTaxonomyCapability(new MemoryCache());
    const affinities = affinitiesFromSegments(['affinity.features.cordless.high', 'affinity.features.outdoor.medium']);
    const first = await capability.expandAffinities({ affinities });
    const second = await capability.expandAffinities({ affinities });

    if (!first.success || !second.success) {
      assert.fail();
    }
    expect(first.meta.cache.hit).toBe(false);
    expect(second.meta.cache.hit).toBe(false);
    expect(capability.requested).toEqual(['features', 'features']);
    const outdoor = first.value.find((e) => e.identifier.key === 'features/outdoor');
    // medium is 0.6, which beats cordless being related to it at 0.5 * 1
    expect(outdoor).toMatchObject({ weight: 0.6, via: 'exact' });
    expect(first.value.find((e) => e.identifier.key === 'features/cordless')).toMatchObject({ weight: 1, via: 'exact' });
  });

  it('only takes the top N and ignores unusable scores', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandAffinities({
      affinities: { 'features/cordless': 5, 'features/outdoor': 4, 'features/garden': 3, 'features/corded': -1, 'features/power': 0 },
      topN: 1,
      policy: { relatedWeight: 0, narrowerWeight: 0, broaderWeight: 0 },
    });

    if (!result.success) {
      assert.fail();
    }
    expect(keys(result.value)).toEqual(['features/cordless']);
  });

  it('rejects scores that are not finite numbers', async () => {
    const result = await new StubTaxonomyCapability().expandAffinities({ affinities: { 'features/cordless': Number.NaN } });

    expect(result.success).toBe(false);
  });
});

describe('TaxonomyCapability.rankByConcepts', () => {
  const items = [
    { key: 'cordless-article', concepts: ['features/cordless'] },
    { key: 'power-article', concepts: ['features/power'] },
    { key: 'garden-article', concepts: ['features/garden'] },
    { key: 'unrelated', concepts: ['other/x'] },
  ];

  async function setup() {
    const capability = new StubTaxonomyCapability();
    const context = await expanded(capability, 'features/cordless');
    const affinity = await expanded(capability, 'features/garden');
    return { capability, context, affinity };
  }

  async function rank(capability: TaxonomyCapability, payload: Parameters<TaxonomyCapability['rankByConcepts']>[0]): Promise<ConceptRankedItem[]> {
    const result = await capability.rankByConcepts(payload);
    if (!result.success) {
      assert.fail();
    }
    return result.value;
  }

  it('ranks by relevance to the context alone without an affinity', async () => {
    const { capability, context } = await setup();

    const result = await rank(capability, { items, context });

    expect(result.map((r) => r.key)).toEqual(['cordless-article', 'power-article', 'garden-article', 'unrelated']);
    expect(result[0]).toMatchObject({ score: 1, relevance: 1, affinity: 0 });
    expect(result[2].score).toBe(0);
  });

  it('is identical to context only ranking when no affinity is given, in every mode', async () => {
    const { capability, context } = await setup();
    const contextOnly = await rank(capability, { items, context, personalization: { mode: 'context' } });

    for (const mode of ['blend', 'context'] as const) {
      expect(await rank(capability, { items, context, personalization: { mode, strength: 1 } })).toEqual(contextOnly);
    }
    expect(await rank(capability, { items, context })).toEqual(contextOnly);
    expect(await rank(capability, { items, context, affinity: [] })).toEqual(contextOnly);
    // the profile mode has nothing to rank on without a profile, every item scores 0 in input order
    const profileOnly = await rank(capability, { items, context, personalization: { mode: 'profile' } });
    expect(profileOnly.map((r) => [r.key, r.score])).toEqual(items.map((item) => [item.key, 0]));
  });

  it('lets the affinity reorder relevant items by at most the strength', async () => {
    const { capability, affinity } = await setup();
    // two relevant items, the visitor is into garden, which only the second one is tagged with
    const context: ExpandedConcept[] = [
      { identifier: { key: 'a/one' }, weight: 1, via: 'exact' },
      { identifier: { key: 'a/two' }, weight: 0.9, via: 'exact' },
    ];
    const twoItems = [
      { key: 'plain', concepts: ['a/one'] },
      { key: 'liked', concepts: ['a/two', 'features/garden'] },
    ];

    const plain = await rank(capability, { items: twoItems, context });
    const blended = await rank(capability, { items: twoItems, context, affinity, personalization: { mode: 'blend', strength: 0.5 } });

    expect(plain.map((r) => r.key)).toEqual(['plain', 'liked']);
    // liked: relevance 0.9, affinity 1, so 0.9 * (1 + 0.5 * 1)
    expect(blended.map((r) => r.key)).toEqual(['liked', 'plain']);
    expect(blended[0].score).toBeCloseTo(1.35, 10);
    for (const item of blended) {
      expect(item.score).toBeLessThanOrEqual(item.relevance * 1.5 + 1e-9);
    }
    // at full strength the score at most doubles
    const strong = await rank(capability, { items: twoItems, context, affinity, personalization: { strength: 1 } });
    expect(strong.find((r) => r.key === 'liked')?.score).toBeCloseTo(1.8, 10);
    for (const item of strong) {
      expect(item.score).toBeLessThanOrEqual(item.relevance * 2 + 1e-9);
    }
    // a strength outside of 0..1 is no valid payload
    const invalid = await capability.rankByConcepts({ items: twoItems, context, affinity, personalization: { strength: 5 } });
    expect(invalid.success).toBe(false);
  });

  it('breaks ties between equal scores by relevance first, then by input order', async () => {
    const capability = new StubTaxonomyCapability();
    const context: ExpandedConcept[] = [{ identifier: { key: 'a/one' }, weight: 0.5, via: 'exact' }];
    const affinity: ExpandedConcept[] = [
      { identifier: { key: 'a/one' }, weight: 0.6, via: 'exact' },
      { identifier: { key: 'a/liked' }, weight: 0.6, via: 'exact' },
    ];
    const tied = [
      { key: 'first-no-relevance', concepts: ['a/liked'] },
      { key: 'second-relevant', concepts: ['a/one'] },
      { key: 'third-no-relevance', concepts: ['a/liked'] },
      { key: 'fourth-relevant', concepts: ['a/one'] },
    ];

    // profile mode: all four have affinity 0.6, the relevant ones win the tie, each group in input order
    const result = await rank(capability, { items: tied, context, affinity, personalization: { mode: 'profile' } });

    expect(result.map((r) => r.key)).toEqual(['second-relevant', 'fourth-relevant', 'first-no-relevance', 'third-no-relevance']);
  });

  it('ranks like context only for a profile without affinity segments', async () => {
    const { capability, context } = await setup();
    // a profile with segments but none of them an affinity one
    const affinities = affinitiesFromSegments(['vip', 'trait.craftsmantype.lumberjack.high']);

    const expandedAffinities = await capability.expandAffinities({ affinities });
    if (!expandedAffinities.success) {
      assert.fail();
    }
    const withProfile = await rank(capability, { items, context, affinity: expandedAffinities.value });
    const contextOnly = await rank(capability, { items, context, personalization: { mode: 'context' } });

    expect(expandedAffinities.value).toEqual([]);
    expect(withProfile).toEqual(contextOnly);
  });

  it('keeps an item without relevance at zero in blend mode when a context is given', async () => {
    const { capability, context, affinity } = await setup();

    const result = await rank(capability, { items, context, affinity, personalization: { mode: 'blend', strength: 1 } });

    const garden = result.find((r) => r.key === 'garden-article');
    expect(garden).toMatchObject({ score: 0, relevance: 0 });
    expect(garden?.affinity).toBeGreaterThan(0);
  });

  it('ranks on the profile alone in profile mode and for blend without a context', async () => {
    const { capability, context, affinity } = await setup();

    const profile = await rank(capability, { items, context, affinity, personalization: { mode: 'profile' } });
    const feed = await rank(capability, { items, affinity });

    expect(profile[0].key).toBe('garden-article');
    expect(feed.map((r) => r.key)).toEqual(profile.map((r) => r.key));
    expect(feed[0]).toMatchObject({ key: 'garden-article', score: 1, relevance: 0 });
    // nothing at all to rank on
    expect((await rank(capability, { items })).every((r) => r.score === 0)).toBe(true);
  });

  it('keeps the order of equal scores', async () => {
    const result = await rank(new StubTaxonomyCapability(), {
      items: [
        { key: 'b', concepts: [] },
        { key: 'a', concepts: [] },
      ],
    });

    expect(result.map((r) => r.key)).toEqual(['b', 'a']);
  });
});

describe('TaxonomyCapability.expandConcepts with the closure of Product.concepts', () => {
  // what a product tagged with features/cordless carries: the concept and its ancestor
  const closure = [
    { identifier: { key: 'features/power' }, vocabulary: 'features', name: 'power' },
    { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'cordless', parent: { key: 'features/power' } },
  ];

  function byKey(expansion: ExpandedConcept[]) {
    return Object.fromEntries(expansion.map((e) => [e.identifier.key, [e.weight, e.via]]));
  }

  it('expands the assigned concept only, the ancestor is broader and its other children are not reached', async () => {
    const result = await new StubTaxonomyCapability().expandConcepts({ concepts: closure });

    if (!result.success) {
      assert.fail();
    }
    const weights = byKey(result.value);
    expect(weights['features/cordless']).toEqual([1, 'exact']);
    expect(weights['features/power']).toEqual([0.4, 'broader']);
    expect(weights['features/battery-18v']).toEqual([0.8, 'narrower']);
    expect(weights['features/outdoor']).toEqual([0.5, 'related']);
    // corded is a sibling, only reachable by treating power as an exact match
    expect(weights['features/corded']).toBeUndefined();
  });

  it('ranks a related concept of the assigned one above the sibling', async () => {
    const capability = new StubTaxonomyCapability();
    const context = await capability.expandConcepts({ concepts: closure });
    if (!context.success) {
      assert.fail();
    }

    const result = await capability.rankByConcepts({
      items: [
        { key: 'about-corded', concepts: ['features/corded'] },
        { key: 'about-outdoor', concepts: ['features/outdoor'] },
        { key: 'about-power', concepts: ['features/power'] },
      ],
      context: context.value,
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((r) => [r.key, r.score])).toEqual([
      ['about-outdoor', 0.5],
      ['about-power', 0.4],
      ['about-corded', 0],
    ]);
  });

  it('takes an ancestor that was assigned as well as broader without directConcepts, and as exact with them', async () => {
    const capability = new StubTaxonomyCapability();

    const inferred = await capability.expandConcepts({ concepts: closure });
    const explicit = await capability.expandConcepts({
      concepts: closure,
      directConcepts: [{ key: 'features/power' }, { key: 'features/cordless' }],
    });

    if (!inferred.success || !explicit.success) {
      assert.fail();
    }
    expect(byKey(inferred.value)['features/power']).toEqual([0.4, 'broader']);
    expect(byKey(inferred.value)['features/corded']).toBeUndefined();
    expect(byKey(explicit.value)['features/power']).toEqual([1, 'exact']);
    expect(byKey(explicit.value)['features/corded']).toEqual([0.8, 'narrower']);
  });

  it('lets directConcepts override the inference, an empty list counts as left out', async () => {
    const capability = new StubTaxonomyCapability();

    const onlyPower = await capability.expandConcepts({ concepts: closure, directConcepts: [{ key: 'features/power' }] });
    const empty = await capability.expandConcepts({ concepts: closure, directConcepts: [] });

    if (!onlyPower.success || !empty.success) {
      assert.fail();
    }
    expect(byKey(onlyPower.value)['features/power']).toEqual([1, 'exact']);
    expect(byKey(onlyPower.value)['features/cordless']).toEqual([0.8, 'narrower']);
    expect(byKey(empty.value)['features/cordless']).toEqual([1, 'exact']);
  });

  it('widens to the vocabularies of the policy and keeps the ones of the concepts', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({ concepts: closure, policy: { vocabularies: ['brands'] } });

    if (!result.success) {
      assert.fail();
    }
    const weights = byKey(result.value);
    expect(weights['features/cordless']).toEqual([1, 'exact']);
    expect(weights['features/outdoor']).toEqual([0.5, 'related']);
    expect(weights['brands/acme']).toEqual([0.5, 'related']);
    expect(capability.requested.sort()).toEqual(['brands', 'features']);
  });
});

describe('TaxonomyCapability input bounds', () => {
  const ids = (count: number, prefix = 'features/c') => Array.from({ length: count }, (_, i) => ({ key: `${prefix}${i}` }));
  const productConcepts = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ identifier: { key: `features/c${i}` }, vocabulary: 'features', name: `c${i}` }));
  const expanded = (count: number): ExpandedConcept[] =>
    Array.from({ length: count }, (_, i) => ({ identifier: { key: `features/c${i}` }, weight: 0.5, via: 'exact' as const }));

  async function expectInvalid(result: Result<unknown>) {
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  }

  it('accepts the maximum and rejects one more', async () => {
    const capability = new StubTaxonomyCapability();

    expect((await capability.expandConcepts({ concepts: productConcepts(200) })).success).toBe(true);
    await expectInvalid(await capability.expandConcepts({ concepts: productConcepts(201) }));
    await expectInvalid(await capability.expandConcepts({ concepts: productConcepts(1), directConcepts: ids(201) }));
    await expectInvalid(await capability.expandConcepts({ concepts: [], policy: { vocabularies: Array.from({ length: 21 }, (_, i) => `v${i}`) } }));
    await expectInvalid(await capability.getRelatedConcepts({ concepts: ids(201) }));
    await expectInvalid(await capability.getRelatedConcepts({ concepts: ids(1), maxDepth: 17 }));
    await expectInvalid(await capability.getRelatedConcepts({ concepts: ids(1), maxDepth: 0 }));
  });

  it('bounds the affinities and the top N', async () => {
    const capability = new StubTaxonomyCapability();
    const affinities = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`features/c${i}`, 0.5]));

    expect((await capability.expandAffinities({ affinities: affinities(200), topN: 100 })).success).toBe(true);
    await expectInvalid(await capability.expandAffinities({ affinities: affinities(201) }));
    await expectInvalid(await capability.expandAffinities({ affinities: {}, topN: 101 }));
  });

  it('bounds the items, their concepts and the expansions of a ranking', async () => {
    const capability = new StubTaxonomyCapability();
    const items = (count: number, concepts = 1) =>
      Array.from({ length: count }, (_, i) => ({ key: `a${i}`, concepts: Array.from({ length: concepts }, (_, c) => `features/c${c}`) }));

    expect((await capability.rankByConcepts({ items: items(1000, 100), context: expanded(2000), affinity: expanded(2000) })).success).toBe(true);
    await expectInvalid(await capability.rankByConcepts({ items: items(1001) }));
    await expectInvalid(await capability.rankByConcepts({ items: items(1, 101) }));
    await expectInvalid(await capability.rankByConcepts({ items: [], context: expanded(2001) }));
    await expectInvalid(await capability.rankByConcepts({ items: [], affinity: expanded(2001) }));
  });

  it('rejects negative weights and a strength outside of 0..1', async () => {
    const capability = new StubTaxonomyCapability();
    const negative: ExpandedConcept[] = [{ identifier: { key: 'features/c1' }, weight: -100, via: 'exact' }];

    await expectInvalid(await capability.rankByConcepts({ items: [], affinity: negative }));
    await expectInvalid(await capability.rankByConcepts({ items: [], personalization: { strength: -0.1 } }));
    await expectInvalid(await capability.expandConcepts({ concepts: [], policy: { relatedWeight: -1 } }));
    await expectInvalid(await capability.expandConcepts({ concepts: [], policy: { minWeight: -0.5 } }));
  });

  it('loads at most four vocabularies at a time and fails for more than forty in a call', async () => {
    class Slow extends StubTaxonomyCapability {
      public active = 0;
      public peak = 0;
      public override async getVocabulary(payload: TaxonomyQueryGetVocabulary): Promise<Result<Vocabulary, NotFoundError>> {
        this.active += 1;
        this.peak = Math.max(this.peak, this.active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        this.active -= 1;
        return super.getVocabulary(payload);
      }
    }
    const capability = new Slow();
    const concepts = (count: number) => Array.from({ length: count }, (_, i) => ({ identifier: { key: `vocab${i}/x` }, vocabulary: `vocab${i}`, name: 'x' }));

    const result = await capability.expandConcepts({ concepts: concepts(40) });

    expect(result.success).toBe(true);
    expect(capability.peak).toBeLessThanOrEqual(4);
    expect(capability.peak).toBeGreaterThan(1);
    expect(new Set(capability.requested).size).toBe(40);

    // more than forty is an error and loads nothing, instead of silently leaving some out
    const tooMany = new Slow();
    const failed = await tooMany.expandConcepts({ concepts: concepts(41) });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.type).toBe('InvalidInput');
      expect(JSON.stringify(failed.error)).toContain('41');
    }
    expect(tooMany.requested).toEqual([]);
  });

  it('ranks a thousand items against two thousand concepts well under a second', async () => {
    const capability = new StubTaxonomyCapability();
    const items = Array.from({ length: 1000 }, (_, i) => ({
      key: `a${i}`,
      concepts: Array.from({ length: 20 }, (_, c) => `features/c${(i * 7 + c * 13) % 4000}`),
    }));
    const started = performance.now();

    const result = await capability.rankByConcepts({ items, context: expanded(2000), affinity: expanded(2000) });

    expect(result.success).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe('TaxonomyCapability expansion size and direct concepts', () => {
  const wide = (children: number) => {
    const root = concept('wide/root', {
      children: Array.from({ length: children }, (_, i) => concept(`wide/c${i}`, { parent: { key: 'wide/root' } })),
    });
    return vocabulary('wide', [root]);
  };

  it('cuts an expansion to the 2000 highest weights and it still feeds rankByConcepts', async () => {
    const capability = new StubTaxonomyCapability(new NoOpCache(), [wide(3000)]);

    const result = await capability.expandConcepts({ concepts: [{ identifier: { key: 'wide/root' }, vocabulary: 'wide', name: 'root' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value).toHaveLength(2000);
    expect(result.value[0]).toMatchObject({ via: 'exact', weight: 1 });
    expect(result.value.slice(1).every((e) => e.via === 'narrower')).toBe(true);

    const ranked = await capability.rankByConcepts({ items: [{ key: 'a1', concepts: ['wide/root'] }], context: result.value });
    expect(ranked.success).toBe(true);
  });

  it('cuts the expansion of affinities too and keeps the exact concepts', async () => {
    const capability = new StubTaxonomyCapability(new NoOpCache(), [wide(3000)]);

    const result = await capability.expandAffinities({ affinities: { 'wide/root': 0.5, 'wide/c1': 1 } });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value).toHaveLength(2000);
    expect(result.value.filter((e) => e.via === 'exact').map((e) => e.identifier.key).sort()).toEqual(['wide/c1', 'wide/root']);
    expect((await capability.rankByConcepts({ items: [], affinity: result.value })).success).toBe(true);
  });

  it('expands exactly the given directConcepts, also ids that are not in concepts', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({
      concepts: [{ identifier: { key: 'features/power' }, vocabulary: 'features', name: 'power' }],
      directConcepts: [{ key: 'features/cordless' }],
    });

    if (!result.success) {
      assert.fail();
    }
    const byId = Object.fromEntries(result.value.map((e) => [e.identifier.key, [e.weight, e.via]]));
    // cordless was not in concepts, it is the seed, power is only an ancestor of it
    expect(byId['features/cordless']).toEqual([1, 'exact']);
    expect(byId['features/power']).toEqual([0.4, 'broader']);
    expect(byId['features/corded']).toBeUndefined();
  });

  it('takes the parent of a direct concept from concepts when it is there, for a taxonomy that is not loaded', async () => {
    const capability = new StubTaxonomyCapability(new NoOpCache(), []);

    const result = await capability.expandConcepts({
      concepts: [{ identifier: { key: 'features/unknown' }, vocabulary: 'features', name: 'unknown', parent: { key: 'features/top' } }],
      directConcepts: [{ key: 'features/unknown' }],
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((e) => [e.identifier.key, e.via])).toEqual([['features/unknown', 'exact'], ['features/top', 'broader']]);
  });

  it('expands all concepts when their parent links go in a circle', async () => {
    const capability = new StubTaxonomyCapability();

    const result = await capability.expandConcepts({
      concepts: [
        { identifier: { key: 'features/x' }, vocabulary: 'features', name: 'x', parent: { key: 'features/y' } },
        { identifier: { key: 'features/y' }, vocabulary: 'features', name: 'y', parent: { key: 'features/x' } },
      ],
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.filter((e) => e.via === 'exact').map((e) => e.identifier.key).sort()).toEqual(['features/x', 'features/y']);
  });
});
