import { describe, expect, it } from 'vitest';
import { PersonalizationProfileSchema } from '../schemas/models/personalization-profile.model.js';

describe('PersonalizationProfileSchema affinities', () => {
  it('defaults to no affinities', () => {
    expect(PersonalizationProfileSchema.parse({ identifier: { key: 'p1' } }).affinities).toEqual({});
  });

  it('keeps the banded affinities of a profile', () => {
    const profile = PersonalizationProfileSchema.parse({
      identifier: { key: 'p1' },
      segments: ['affinity.features.cordless.high'],
      affinities: { 'features/cordless': 1 },
    });

    expect(profile.affinities).toEqual({ 'features/cordless': 1 });
  });

  it('rejects affinities that are not numbers', () => {
    expect(PersonalizationProfileSchema.safeParse({ identifier: { key: 'p1' }, affinities: { 'features/cordless': 'high' } }).success).toBe(false);
  });
});
