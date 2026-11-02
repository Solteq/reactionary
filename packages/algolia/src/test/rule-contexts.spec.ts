import { describe, expect, it } from 'vitest';
import { MAX_RULE_CONTEXTS, matchesSegmentPattern, segmentRuleContexts } from '../core/rule-contexts.js';

describe('segmentRuleContexts', () => {
  it('has no contexts without a profile', () => {
    expect(segmentRuleContexts(undefined)).toEqual([]);
    expect(segmentRuleContexts({ segments: [] })).toEqual([]);
  });

  it('makes one context per segment, in alphabetical order whatever order the CDP lists them in', () => {
    expect(segmentRuleContexts({ segments: ['vip', 'lapsed', 'power-tool-enthusiast'] })).toEqual([
      'segment_lapsed',
      'segment_power-tool-enthusiast',
      'segment_vip',
    ]);
    expect(segmentRuleContexts({ segments: ['b', 'a'] })).toEqual(segmentRuleContexts({ segments: ['a', 'b'] }));
  });

  it('orders by code point, not by the locale of the server', () => {
    expect(segmentRuleContexts({ segments: ['b', 'B', 'a'] })).toEqual(['segment_B', 'segment_a', 'segment_b']);
  });

  it('never sends the affinity segments, they rank products', () => {
    expect(
      segmentRuleContexts({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.application.power-tools.low', 'affinity-fan'] }),
    ).toEqual(['segment_affinity-fan', 'segment_vip']);
  });

  it('replaces every character Algolia does not accept, and sends a context once', () => {
    // in the order of the segment names: 'a b.c' comes before 'a/b' and 'a_b', which become the same context
    expect(segmentRuleContexts({ segments: ['big spender', 'a/b', 'a_b', 'a b.c'] })).toEqual(['segment_a_b_c', 'segment_a_b', 'segment_big_spender']);
  });

  it('sends at most what Algolia takes, and the first alphabetically when there are more', () => {
    const segments = Array.from({ length: 14 }, (_, i) => `s${String(i).padStart(2, '0')}`).reverse();
    const contexts = segmentRuleContexts({ segments });

    expect(contexts).toHaveLength(MAX_RULE_CONTEXTS);
    expect(contexts[0]).toBe('segment_s00');
    expect(contexts[MAX_RULE_CONTEXTS - 1]).toBe('segment_s09');
  });

  it('can be given less room, for the labels that are sent next to it', () => {
    expect(segmentRuleContexts({ segments: ['c', 'a', 'b'] }, { max: 2 })).toEqual(['segment_a', 'segment_b']);
    expect(segmentRuleContexts({ segments: ['a'] }, { max: 0 })).toEqual([]);
    expect(segmentRuleContexts({ segments: ['a'] }, { max: -3 })).toEqual([]);
  });

  describe('with a list of allowed segments', () => {
    const segments = ['vip', 'campaign-spring', 'campaign-summer', 'lapsed', 'affinity.features.cordless.high'];

    it('sends only the segments that match', () => {
      expect(segmentRuleContexts({ segments }, { allowed: ['vip', 'lapsed'] })).toEqual(['segment_lapsed', 'segment_vip']);
    });

    it('takes * as any characters', () => {
      expect(segmentRuleContexts({ segments }, { allowed: ['campaign-*'] })).toEqual(['segment_campaign-spring', 'segment_campaign-summer']);
    });

    it('sends none for an empty list, and everything for no list', () => {
      expect(segmentRuleContexts({ segments }, { allowed: [] })).toEqual([]);
      expect(segmentRuleContexts({ segments }, {})).toHaveLength(4);
    });

    it('does not let a pattern allow an affinity segment', () => {
      expect(segmentRuleContexts({ segments }, { allowed: ['*'] })).not.toContain('segment_affinity_features_cordless_high');
    });

    it('applies the cut after the list', () => {
      expect(segmentRuleContexts({ segments }, { allowed: ['campaign-*', 'vip'], max: 2 })).toEqual(['segment_campaign-spring', 'segment_campaign-summer']);
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
