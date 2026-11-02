import { describe, expect, it } from 'vitest';
import { MAX_RULE_CONTEXTS, segmentRuleContexts } from '../core/rule-contexts.js';

describe('segmentRuleContexts', () => {
  it('has no contexts without a profile', () => {
    expect(segmentRuleContexts(undefined)).toEqual([]);
    expect(segmentRuleContexts({ segments: [] })).toEqual([]);
  });

  it('makes one context per segment', () => {
    expect(segmentRuleContexts({ segments: ['vip', 'power-tool-enthusiast'] })).toEqual(['segment_vip', 'segment_power-tool-enthusiast']);
  });

  it('sends the high affinity segments with the characters Algolia does not accept replaced', () => {
    expect(segmentRuleContexts({ segments: ['affinity.features.cordless.high', 'affinity.application.power-tools.high'] })).toEqual([
      'segment_affinity_features_cordless_high',
      'segment_affinity_application_power-tools_high',
    ]);
  });

  it('leaves the lower affinity bands out, they are for ranking', () => {
    expect(
      segmentRuleContexts({ segments: ['vip', 'affinity.features.cordless.medium', 'affinity.application.power-tools.low', 'affinity-fan'] }),
    ).toEqual(['segment_vip', 'segment_affinity-fan']);
  });

  it('replaces whatever else Algolia does not accept in a segment name', () => {
    expect(segmentRuleContexts({ segments: ['big spender', 'a/b'] })).toEqual(['segment_big_spender', 'segment_a_b']);
  });

  it('sends a context once', () => {
    expect(segmentRuleContexts({ segments: ['a b', 'a_b'] })).toEqual(['segment_a_b']);
  });

  it('sends at most what Algolia takes, the curated segments first', () => {
    const affinity = Array.from({ length: 12 }, (_, i) => `affinity.features.f${i}.high`);
    const contexts = segmentRuleContexts({ segments: [...affinity, 'vip', 'lapsed'] });

    expect(contexts).toHaveLength(MAX_RULE_CONTEXTS);
    expect(contexts.slice(0, 2)).toEqual(['segment_vip', 'segment_lapsed']);
  });

  it('can be given less room, for the contexts that are sent next to it', () => {
    expect(segmentRuleContexts({ segments: ['a', 'b', 'c'] }, 2)).toEqual(['segment_a', 'segment_b']);
    expect(segmentRuleContexts({ segments: ['a'] }, 0)).toEqual([]);
    expect(segmentRuleContexts({ segments: ['a'] }, -3)).toEqual([]);
  });
});
