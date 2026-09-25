import { describe, expect, it } from 'vitest';
import { ProfileSchema } from '../schemas/models/profile.model.js';
import { ProfileMutationUpdateSchema } from '../schemas/mutations/profile.mutation.js';

const baseProfile = {
  identifier: { userId: '1' },
  email: 'shopper@example.com',
  phone: '',
  emailVerified: true,
  phoneVerified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfileSchema', () => {
  it('leaves firstName and lastName undefined when a provider omits them', () => {
    const profile = ProfileSchema.parse(baseProfile);

    expect(profile.firstName).toBeUndefined();
    expect(profile.lastName).toBeUndefined();
  });

  it('keeps provided firstName and lastName', () => {
    const profile = ProfileSchema.parse({
      ...baseProfile,
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });
});

describe('ProfileMutationUpdateSchema', () => {
  const baseMutation = {
    identifier: { userId: '1' },
    email: 'shopper@example.com',
    phone: '',
  };

  it('accepts optional firstName and lastName', () => {
    const mutation = ProfileMutationUpdateSchema.parse({
      ...baseMutation,
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(mutation.firstName).toBe('Jane');
    expect(mutation.lastName).toBe('Doe');
  });

  it('leaves firstName and lastName undefined when omitted', () => {
    const mutation = ProfileMutationUpdateSchema.parse(baseMutation);

    expect(mutation.firstName).toBeUndefined();
    expect(mutation.lastName).toBeUndefined();
  });
});
