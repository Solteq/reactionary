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
import { createVocabularies } from './taxonomy-fixtures.js';

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

  it('is cached', async () => {
    const capability = new StubTaxonomyCapability(new MemoryCache());

    const first = await capability.expandConcepts({ concepts: [cordlessSeed] });
    const second = await capability.expandConcepts({ concepts: [cordlessSeed] });

    if (!first.success || !second.success) {
      assert.fail();
    }
    expect(first.meta.cache.hit).toBe(false);
    expect(second.meta.cache.hit).toBe(true);
    expect(capability.requested).toEqual(['features']);
  });

  it('takes the default policy from a hook that subclasses can override, and the call wins', async () => {
    class Tuned extends StubTaxonomyCapability {
      protected override defaultExpansionPolicy() {
        return { relatedWeight: 0.9, minWeight: 0.3 };
      }
    }
    const capability = new Tuned();

    const tuned = await capability.expandConcepts({ concepts: [cordlessSeed] });
    const overridden = await capability.expandConcepts({ concepts: [cordlessSeed], policy: { relatedWeight: 0.35 } });

    if (!tuned.success || !overridden.success) {
      assert.fail();
    }
    expect(tuned.value.find((e) => e.identifier.key === 'features/outdoor')?.weight).toBe(0.9);
    // minWeight 0.3 from the hook cuts the broader concepts of 0.4 * decay
    expect(keys(tuned.value)).toContain('features/power');
    expect(overridden.value.find((e) => e.identifier.key === 'features/outdoor')?.weight).toBe(0.35);
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
    // the strength is clamped to 1, so at most doubling
    const strong = await rank(capability, { items: twoItems, context, affinity, personalization: { strength: 5 } });
    expect(strong.find((r) => r.key === 'liked')?.score).toBeCloseTo(1.8, 10);
    for (const item of strong) {
      expect(item.score).toBeLessThanOrEqual(item.relevance * 2 + 1e-9);
    }
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
