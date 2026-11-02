import { describe, expect, it } from 'vitest';
import { MAX_STRONG_INTERESTS, MAX_USER_CONTEXT_LENGTH, userContextOf } from '../core/user-context.js';

const profile = (overrides: { blurb?: string; segments?: string[]; affinities?: Record<string, number> }) => ({
  blurb: '',
  segments: [],
  affinities: {},
  ...overrides,
});

describe('userContextOf', () => {
  it('has nothing to say without a profile or of an empty one', () => {
    expect(userContextOf(undefined)).toBeUndefined();
    expect(userContextOf(profile({}))).toBeUndefined();
  });

  it('says the segments alphabetically', () => {
    expect(userContextOf(profile({ segments: ['vip', 'lapsed', 'campaign'] }))).toBe('The customer is in the following segments: campaign, lapsed, vip');
  });

  it('says the strong interests in words, then the other segments', () => {
    expect(
      userContextOf(
        profile({
          segments: ['vip', 'lapsed'],
          affinities: { 'features/cordless': 1, 'application/power-tools': 1 },
        }),
      ),
    ).toBe('Strong interest in: power tools, cordless. The customer is in the following segments: lapsed, vip');
  });

  it('leaves the medium and the low interests out', () => {
    expect(userContextOf(profile({ affinities: { 'features/cordless': 1, 'application/drilling-fastening': 0.6, 'trade/carpenter': 0.3 } }))).toBe(
      'Strong interest in: cordless',
    );
    expect(userContextOf(profile({ affinities: { 'application/drilling-fastening': 0.6, 'trade/carpenter': 0.3 } }))).toBeUndefined();
  });

  it('leaves the affinity segments out of the segments', () => {
    expect(
      userContextOf(profile({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.trade.carpenter.low'], affinities: { 'features/cordless': 1 } })),
    ).toBe('Strong interest in: cordless. The customer is in the following segments: vip');
  });

  it('has nothing to say when the segments are all affinity segments and no interest is strong', () => {
    expect(userContextOf(profile({ segments: ['affinity.trade.carpenter.low'], affinities: { 'trade/carpenter': 0.3 } }))).toBeUndefined();
  });

  it('gives the same text whatever order the interests and segments come in', () => {
    const one = profile({ segments: ['b', 'a'], affinities: { 'features/y': 1, 'features/x': 1 } });
    const other = profile({ segments: ['a', 'b'], affinities: { 'features/x': 1, 'features/y': 1 } });
    expect(userContextOf(one)).toBe(userContextOf(other));
  });

  it('names at most five strong interests, by concept id, and a name once', () => {
    const affinities = Object.fromEntries(['g', 'f', 'e', 'd', 'c', 'b', 'a'].map((slug) => [`features/${slug}`, 1]));
    expect(MAX_STRONG_INTERESTS).toBe(5);
    expect(userContextOf(profile({ affinities }))).toBe('Strong interest in: a, b, c, d, e');
    expect(userContextOf(profile({ affinities: { 'application/power-tools': 1, 'features/power_tools': 1 } }))).toBe('Strong interest in: power tools');
  });

  it('puts the blurb first', () => {
    expect(userContextOf(profile({ blurb: 'Likes drills', segments: ['vip'], affinities: { 'features/cordless': 1 } }))).toBe(
      'Likes drills. Strong interest in: cordless. The customer is in the following segments: vip',
    );
  });

  it('cuts the text where it is too long, the segments before the interests', () => {
    const segments = Array.from({ length: 80 }, (_, i) => `segment-number-${String(i).padStart(3, '0')}`);
    const text = userContextOf(profile({ segments, affinities: { 'features/cordless': 1 } })) ?? '';

    expect(text).toHaveLength(MAX_USER_CONTEXT_LENGTH);
    expect(text.startsWith('Strong interest in: cordless. The customer is in the following segments: segment-number-000')).toBe(true);
  });
});
