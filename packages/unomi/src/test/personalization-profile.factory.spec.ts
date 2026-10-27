import { describe, expect, it } from 'vitest';
import { createInitialRequestContext, PersonalizationProfileSchema } from '@reactionary/core';
import { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';

function parse(segments: Array<string | { id?: string; name?: string }>) {
  return new UnomiPersonalizationProfileFactory(PersonalizationProfileSchema).parsePersonalizationProfile(
    createInitialRequestContext(),
    { profileId: 'profile-1', segments },
  );
}

describe('UnomiPersonalizationProfileFactory affinities', () => {
  it('derives the affinities from the affinity segments and keeps all segments', () => {
    const profile = parse([
      'vip',
      'affinity.features.cordless.high',
      { name: 'affinity.brands.acme.low' },
      { id: 'affinity.features.outdoor.medium' },
      'affinity.features.cordless.low',
      'trait.craftsmantype.lumberjack.high',
      'affinity.features.cordless',
      'affinity.features.cordless.high.extra',
      'Affinity.features.garden.high',
      'affinity.features.garden.HIGH',
    ]);

    expect(profile.affinities).toEqual({
      'features/cordless': 1,
      'brands/acme': 0.3,
      'features/outdoor': 0.6,
    });
    expect(profile.segments).toContain('vip');
    expect(profile.segments).toContain('affinity.features.cordless.high');
    expect(profile.identifier.key).toBe('profile-1');
  });

  it('reads the affinity from both the name and the id of a segment object, the highest band wins', () => {
    const profile = parse([
      { id: 'affinity.features.cordless.low', name: 'affinity.features.outdoor.high' },
      { id: 'affinity.features.cordless.high', name: 'Cordless lovers' },
      { id: 'affinity.brands.acme.medium', name: 'affinity.brands.acme.low' },
      { id: 'segment-id-1' },
    ]);

    expect(profile.affinities).toEqual({
      'features/cordless': 1,
      'features/outdoor': 1,
      'brands/acme': 0.6,
    });
    // the segment list keeps preferring the name
    expect(profile.segments).toEqual(['affinity.features.outdoor.high', 'Cordless lovers', 'affinity.brands.acme.low', 'segment-id-1']);
  });

  it('has no affinities without affinity segments', () => {
    expect(parse(['vip', 'trait.craftsmantype.lumberjack.high']).affinities).toEqual({});
    expect(parse([]).affinities).toEqual({});
  });

  it('does not read raw scores from the profile properties', () => {
    const profile = new UnomiPersonalizationProfileFactory(PersonalizationProfileSchema).parsePersonalizationProfile(
      createInitialRequestContext(),
      { profileId: 'profile-1', properties: { interests: { 'features/cordless': 87 } }, segments: [] },
    );

    expect(profile.affinities).toEqual({});
  });
});
