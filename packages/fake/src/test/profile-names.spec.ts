import type { RequestContext } from '@reactionary/core';
import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { FakeProfileCapability } from '../capabilities/profile.capability.js';
import { FakeProfileFactory } from '../factories/index.js';
import { getFakerTestConfiguration } from './test-utils.js';

describe('Fake Profile Provider names', () => {
  let provider: FakeProfileCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeProfileCapability(getFakerTestConfiguration(), new NoOpCache(), reqCtx, new FakeProfileFactory(ProfileSchema));
  });

  const identifier = { userId: '1234' };

  it('gives the profile a first and last name, as the providers of a real backend do', async () => {
    const result = await provider.getById({ identifier });
    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.firstName).toBeTruthy();
    expect(result.value.lastName).toBeTruthy();
  });

  it('returns the names that an update is given', async () => {
    const result = await provider.update({ identifier, email: 'jane@example.com', phone: '5551234', firstName: 'Janet', lastName: 'Roe' });
    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.firstName).toBe('Janet');
    expect(result.value.lastName).toBe('Roe');
  });

  it('returns the one name that is given, and a generated one for the other', async () => {
    const result = await provider.update({ identifier, email: 'jane@example.com', phone: '5551234', lastName: 'Roe' });
    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.lastName).toBe('Roe');
    expect(result.value.firstName).toBeTruthy();
  });
});
