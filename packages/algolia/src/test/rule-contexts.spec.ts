import { describe, expect, it } from 'vitest';
import { segmentRuleContexts } from '../core/rule-contexts.js';

describe('segmentRuleContexts', () => {
  it('has no contexts without a profile', () => {
    expect(segmentRuleContexts(undefined)).toEqual([]);
    expect(segmentRuleContexts({ segments: [] })).toEqual([]);
  });

  it('makes one context per segment', () => {
    expect(segmentRuleContexts({ segments: ['vip', 'power-tool-enthusiast'] })).toEqual(['segment_vip', 'segment_power-tool-enthusiast']);
  });

  it('leaves the affinity segments out, they are for ranking and not for rules', () => {
    expect(
      segmentRuleContexts({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.application.power-tools.low', 'affinity-fan'] }),
    ).toEqual(['segment_vip', 'segment_affinity-fan']);
  });
});
