import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { assert, describe, expect, it, vi } from 'vitest';
import { HclProfileCapability } from '../capabilities/profile.capability.js';
import { HclClient } from '../core/client.js';
import { HclProfileFactory } from '../factories/profile/profile.factory.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';
import type { HclPersonResponse } from '../schema/hcl.schema.js';

// Offline (mocked) tests: nothing here leaves the mocked client.
const person: HclPersonResponse = {
  userId: '1001',
  logonId: 'jane@example.com',
  email1: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone1: '5551234',
};

describe('HclProfileFactory names', () => {
  const factory = new HclProfileFactory(ProfileSchema);
  const context = createInitialRequestContext();

  it('maps firstName and lastName of the person onto the profile', () => {
    const profile = factory.parseProfile(context, person);
    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });

  it('leaves the names undefined when the person has none, or empty ones', () => {
    const missing = factory.parseProfile(context, { userId: '1001', email1: 'jane@example.com' });
    expect(missing.firstName).toBeUndefined();
    expect(missing.lastName).toBeUndefined();

    const empty = factory.parseProfile(context, { ...person, firstName: '', lastName: '' });
    expect(empty.firstName).toBeUndefined();
    expect(empty.lastName).toBeUndefined();
  });
});

describe('HclProfileCapability update of the names', () => {
  function buildProvider(afterUpdate: HclPersonResponse) {
    const reqCtx = createInitialRequestContext();
    const config = HclConfigurationSchema.parse({
      apiUrl: 'https://hcl.example.com/wcs/resources',
      searchApiUrl: 'https://hcl.example.com/search/resources',
      storeId: '41',
    });
    const client = new HclClient(config, reqCtx);
    const callPut = vi.spyOn(client, 'callPut').mockResolvedValue({});
    vi.spyOn(client, 'callGet').mockResolvedValue(afterUpdate);
    const provider = new HclProfileCapability(new NoOpCache(), reqCtx, config, client, new HclProfileFactory(ProfileSchema));
    return { provider, callPut };
  }

  const mutation = { identifier: { userId: '1001' }, email: 'jane@example.com', phone: '5551234' };

  it('sends the names with the update of the person and returns them on the profile', async () => {
    const { provider, callPut } = buildProvider({ ...person, firstName: 'Janet', lastName: 'Roe' });

    const result = await provider.update({ ...mutation, firstName: 'Janet', lastName: 'Roe' });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(callPut).toHaveBeenCalledOnce();
    expect(String(callPut.mock.calls[0][0])).toMatch(/\/person\/@self$/);
    expect(callPut.mock.calls[0][1]).toEqual({ email1: 'jane@example.com', phone1: '5551234', firstName: 'Janet', lastName: 'Roe' });
    expect(result.value.firstName).toBe('Janet');
    expect(result.value.lastName).toBe('Roe');
  });

  it('leaves the names out of the update when they are not given', async () => {
    const { provider, callPut } = buildProvider(person);

    const result = await provider.update(mutation);

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    const body = callPut.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toEqual({ email1: 'jane@example.com', phone1: '5551234' });
    expect(body).not.toHaveProperty('firstName');
    expect(body).not.toHaveProperty('lastName');
  });

  it('sends only the name that is given', async () => {
    const { provider, callPut } = buildProvider(person);

    await provider.update({ ...mutation, lastName: 'Roe' });

    const body = callPut.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toHaveProperty('lastName', 'Roe');
    expect(body).not.toHaveProperty('firstName');
  });
});
