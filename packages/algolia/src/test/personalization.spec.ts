import { describe, expect, it } from 'vitest';
import { AlgoliaPersonalization, matchesSegmentPattern } from '../core/personalization.js';

type Profile = { segments?: string[]; affinities?: Record<string, number> };

const personalization = (ruleContextSegments?: string[]) => new AlgoliaPersonalization({ ruleContextSegments });
const contexts = (profile: Profile, options: { allowed?: string[]; reserved?: number } = {}) =>
  personalization(options.allowed).ruleContexts({ segments: [], ...profile }, options.reserved);
const filters = (affinities: Record<string, number>) => personalization().optionalFilters({ affinities });

describe('AlgoliaPersonalization rule contexts', () => {
  it('has no contexts without a profile', () => {
    expect(personalization().ruleContexts(undefined)).toEqual([]);
    expect(contexts({ segments: [] })).toEqual([]);
  });

  it('makes one context per segment, in alphabetical order whatever order the CDP lists them in', () => {
    expect(contexts({ segments: ['vip', 'lapsed', 'power-tool-enthusiast'] })).toEqual(['segment_lapsed', 'segment_power-tool-enthusiast', 'segment_vip']);
    expect(contexts({ segments: ['b', 'a'] })).toEqual(contexts({ segments: ['a', 'b'] }));
  });

  it('orders by code point, not by the locale of the server', () => {
    expect(contexts({ segments: ['b', 'B', 'a'] })).toEqual(['segment_B', 'segment_a', 'segment_b']);
  });

  it('never sends the affinity segments, they rank products', () => {
    expect(contexts({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.application.power-tools.low', 'affinity-fan'] })).toEqual([
      'segment_affinity-fan',
      'segment_vip',
    ]);
  });

  it('replaces every character Algolia does not accept, and sends a context once', () => {
    // in the order of the segment names: 'a b.c' comes before 'a/b' and 'a_b', which become the same context
    expect(contexts({ segments: ['big spender', 'a/b', 'a_b', 'a b.c'] })).toEqual(['segment_a_b_c', 'segment_a_b', 'segment_big_spender']);
  });

  it('sends at most what Algolia takes, and the first alphabetically when there are more', () => {
    const segments = Array.from({ length: 14 }, (_, i) => `s${String(i).padStart(2, '0')}`).reverse();
    const sent = contexts({ segments });

    expect(sent).toHaveLength(10);
    expect(sent[0]).toBe('segment_s00');
    expect(sent[9]).toBe('segment_s09');
  });

  it('leaves room for the contexts that are sent next to these', () => {
    expect(contexts({ segments: ['c', 'a', 'b'] }, { reserved: 8 })).toHaveLength(2);
    expect(contexts({ segments: ['a'] }, { reserved: 10 })).toEqual([]);
    expect(contexts({ segments: ['a'] }, { reserved: 15 })).toEqual([]);
  });

  it('does not change the segments of the profile', () => {
    const segments = ['b', 'a'];
    contexts({ segments });
    expect(segments).toEqual(['b', 'a']);
  });

  describe('with a list of allowed segments', () => {
    const segments = ['vip', 'campaign-spring', 'campaign-summer', 'lapsed', 'affinity.features.cordless.high'];

    it('sends only the segments that match', () => {
      expect(contexts({ segments }, { allowed: ['vip', 'lapsed'] })).toEqual(['segment_lapsed', 'segment_vip']);
    });

    it('takes * as any characters', () => {
      expect(contexts({ segments }, { allowed: ['campaign-*'] })).toEqual(['segment_campaign-spring', 'segment_campaign-summer']);
    });

    it('sends none for an empty list, and everything for no list', () => {
      expect(contexts({ segments }, { allowed: [] })).toEqual([]);
      expect(contexts({ segments })).toHaveLength(4);
    });

    it('does not let a pattern allow an affinity segment', () => {
      expect(contexts({ segments }, { allowed: ['*'] })).not.toContain('segment_affinity_features_cordless_high');
    });

    it('applies the cut after the list', () => {
      expect(contexts({ segments }, { allowed: ['campaign-*', 'vip'], reserved: 8 })).toEqual(['segment_campaign-spring', 'segment_campaign-summer']);
    });
  });
});

describe('matchesSegmentPattern', () => {
  it('matches the whole name, and only where the wildcard is', () => {
    expect(matchesSegmentPattern(['vip'], 'vip')).toBe(true);
    expect(matchesSegmentPattern(['vip'], 'vip-gold')).toBe(false);
    expect(matchesSegmentPattern(['vip*'], 'vip-gold')).toBe(true);
    expect(matchesSegmentPattern(['*-gold'], 'vip-gold')).toBe(true);
    expect(matchesSegmentPattern(['a*c'], 'abc')).toBe(true);
    expect(matchesSegmentPattern(['a*c'], 'abd')).toBe(false);
  });

  it('takes everything but * literally', () => {
    expect(matchesSegmentPattern(['a.b'], 'axb')).toBe(false);
    expect(matchesSegmentPattern(['a.b'], 'a.b')).toBe(true);
    expect(matchesSegmentPattern(['(a)'], '(a)')).toBe(true);
  });

  it('matches any of several patterns, and nothing for none', () => {
    expect(matchesSegmentPattern(['x', 'y*'], 'yes')).toBe(true);
    expect(matchesSegmentPattern([], 'yes')).toBe(false);
  });
});

describe('AlgoliaPersonalization optional filters', () => {
  it('has no filters without a profile or interests', () => {
    expect(personalization().optionalFilters(undefined)).toEqual([]);
    expect(filters({})).toEqual([]);
  });

  it('scores a strong interest 10 and a some interest 6', () => {
    expect(filters({ 'features/cordless': 1, 'application/power-tools': 0.6 })).toEqual([
      'conceptIds:features/cordless<score=10>',
      'conceptIds:application/power-tools<score=6>',
    ]);
  });

  it('leaves the low interests out', () => {
    expect(filters({ 'trade/carpenter': 0.3, 'features/cordless': 1 })).toEqual(['conceptIds:features/cordless<score=10>']);
  });

  it('puts the strongest first, and orders equal interests by concept id', () => {
    expect(filters({ 'features/b': 1, 'features/a': 1, 'features/c': 0.6 })).toEqual([
      'conceptIds:features/a<score=10>',
      'conceptIds:features/b<score=10>',
      'conceptIds:features/c<score=6>',
    ]);
  });

  it('gives the same filters whatever order the interests come in', () => {
    expect(filters({ 'features/a': 1, 'features/b': 0.6, 'features/c': 1 })).toEqual(filters({ 'features/c': 1, 'features/b': 0.6, 'features/a': 1 }));
  });

  it('keeps at most five concepts', () => {
    const affinities = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((slug) => [`features/${slug}`, 1]));
    const sent = filters(affinities);

    expect(sent).toHaveLength(5);
    expect(sent[4]).toBe('conceptIds:features/e<score=10>');
  });

  it('caps a weight above 1, and leaves out what is not a number or not a concept id', () => {
    expect(filters({ 'features/a': 3, 'features/b': Number.NaN, 'Features/c': 1, 'features/d e': 1, 'features/f<score=99>': 1, plain: 1 })).toEqual([
      'conceptIds:features/a<score=10>',
    ]);
  });
});

describe('AlgoliaPersonalization in a subclass', () => {
  const profile = {
    segments: ['vip', 'lapsed', 'affinity.features.cordless.high'],
    affinities: { 'features/cordless': 1, 'application/power-tools': 0.6, 'trade/carpenter': 0.3 },
  };

  it('can say a context another way', () => {
    class Prefixed extends AlgoliaPersonalization {
      protected override ruleContextOf(segment: string): string {
        return `audience_${segment}`;
      }
    }
    expect(new Prefixed({}).ruleContexts(profile)).toEqual(['audience_lapsed', 'audience_vip']);
  });

  it('can choose which segments may be contexts', () => {
    class OnlyVip extends AlgoliaPersonalization {
      protected override ruleContextSegmentsOf(): string[] {
        return ['vip'];
      }
    }
    expect(new OnlyVip({}).ruleContexts(profile)).toEqual(['segment_vip']);
  });

  it('can change how many contexts and filters there are', () => {
    class Fewer extends AlgoliaPersonalization {
      protected override readonly maxRuleContexts: number = 1;
      protected override readonly maxAffinityFilters: number = 1;
    }
    expect(new Fewer({}).ruleContexts(profile)).toEqual(['segment_lapsed']);
    expect(new Fewer({}).optionalFilters(profile)).toEqual(['conceptIds:features/cordless<score=10>']);
  });

  it('can choose which interests rank', () => {
    class IncludingLow extends AlgoliaPersonalization {
      protected override rankingAffinitiesOf(p: Pick<typeof profile, 'affinities'>): Array<[string, number]> {
        return Object.entries(p.affinities).filter(([id]) => id === 'trade/carpenter');
      }
    }
    expect(new IncludingLow({}).optionalFilters(profile)).toEqual(['conceptIds:trade/carpenter<score=3>']);
  });

  it('can write a filter another way', () => {
    class Boosting extends AlgoliaPersonalization {
      protected override readonly conceptIdsAttribute: string = 'concepts';
      protected override readonly scorePerWeight: number = 100;
    }
    expect(new Boosting({}).optionalFilters(profile)[0]).toBe('concepts:features/cordless<score=100>');

    class Own extends AlgoliaPersonalization {
      protected override optionalFilterOf(conceptId: string, weight: number): string {
        return `${conceptId}=${weight}`;
      }
    }
    expect(new Own({}).optionalFilters(profile)).toEqual(['features/cordless=1', 'application/power-tools=0.6']);
  });
});
