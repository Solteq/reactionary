import { describe, expect, it } from 'vitest';
import { MAX_USER_CONTEXT_LENGTH, userContextOf } from '../core/user-context.js';

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

  it('says the segments, as it always did', () => {
    expect(userContextOf(profile({ segments: ['vip', 'lapsed'] }))).toBe('The customer is in the following segments: vip, lapsed');
  });

  it('uses the blurb in place of the segments', () => {
    expect(userContextOf(profile({ blurb: 'Likes drills', segments: ['vip'] }))).toBe('Likes drills');
  });

  it('says the strong and the some interests in words, strongest first, and leaves the low ones out', () => {
    expect(
      userContextOf(
        profile({
          affinities: {
            'features/cordless': 1,
            'application/power-tools': 1,
            'application/drilling-fastening': 0.6,
            'trade/carpenter': 0.3,
          },
        }),
      ),
    ).toBe('Strong interest in: power tools, cordless. Some interest in: drilling fastening');
  });

  it('leaves the affinity segments out of the segments', () => {
    expect(
      userContextOf(profile({ segments: ['vip', 'affinity.features.cordless.high', 'affinity.trade.carpenter.low'], affinities: { 'features/cordless': 1 } })),
    ).toBe('The customer is in the following segments: vip. Strong interest in: cordless');
  });

  it('has nothing to say when the segments are all affinity segments and no interest is strong enough', () => {
    expect(userContextOf(profile({ segments: ['affinity.trade.carpenter.low'], affinities: { 'trade/carpenter': 0.3 } }))).toBeUndefined();
  });

  it('names at most four concepts of a strength, and a name once', () => {
    const affinities = Object.fromEntries(['e', 'd', 'c', 'b', 'a'].map((slug) => [`features/${slug}`, 1]));
    expect(userContextOf(profile({ affinities }))).toBe('Strong interest in: a, b, c, d');
    expect(userContextOf(profile({ affinities: { 'application/power-tools': 1, 'features/power_tools': 1 } }))).toBe('Strong interest in: power tools');
  });

  it('adds the interests to a blurb, and cuts the whole text where it is too long', () => {
    expect(userContextOf(profile({ blurb: 'Likes drills', affinities: { 'features/cordless': 1 } }))).toBe('Likes drills. Strong interest in: cordless');
    expect(userContextOf(profile({ blurb: 'x'.repeat(900), affinities: { 'features/cordless': 1 } }))).toHaveLength(MAX_USER_CONTEXT_LENGTH);
  });
});
