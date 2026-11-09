import type { StoreCustomer } from '@medusajs/types';
import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { assert, describe, expect, it, vi } from 'vitest';
import { MedusaProfileCapability } from '../capabilities/profile.capability.js';
import type { MedusaAPI } from '../core/client.js';
import { MedusaProfileFactory } from '../factories/profile/profile.factory.js';
import { getMedusaTestConfiguration } from './test-utils.js';

function customer(overrides: Partial<StoreCustomer> = {}): StoreCustomer {
  return {
    id: 'cus_1',
    email: 'jane@example.com',
    default_billing_address_id: null,
    default_shipping_address_id: null,
    company_name: null,
    first_name: 'Jane',
    last_name: 'Doe',
    phone: '5551234',
    addresses: [],
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z',
    ...overrides,
  };
}

describe('MedusaProfileFactory names', () => {
  const factory = new MedusaProfileFactory(ProfileSchema);
  const context = createInitialRequestContext();

  it('maps first_name and last_name of the customer onto the profile', () => {
    const profile = factory.parseProfile(context, customer());
    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });

  it('leaves the names undefined when Medusa has none (null) or empty ones', () => {
    const nulls = factory.parseProfile(context, customer({ first_name: null, last_name: null }));
    expect(nulls.firstName).toBeUndefined();
    expect(nulls.lastName).toBeUndefined();

    const empty = factory.parseProfile(context, customer({ first_name: '', last_name: '' }));
    expect(empty.firstName).toBeUndefined();
    expect(empty.lastName).toBeUndefined();
  });
});

describe('MedusaProfileCapability update of the names', () => {
  function buildProvider(updated: StoreCustomer) {
    const retrieve = vi.fn().mockResolvedValue({ customer: customer() });
    const update = vi.fn().mockResolvedValue({ customer: updated });
    const api = { getClient: vi.fn().mockResolvedValue({ store: { customer: { retrieve, update } } }) };
    const provider = new MedusaProfileCapability(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      createInitialRequestContext(),
      api as unknown as MedusaAPI,
      new MedusaProfileFactory(ProfileSchema),
    );
    return { provider, update };
  }

  const mutation = { identifier: { userId: 'cus_1' }, email: 'jane@example.com', phone: '5551234' };

  it('sends first_name and last_name with the update and returns them on the profile', async () => {
    const { provider, update } = buildProvider(customer({ first_name: 'Janet', last_name: 'Roe' }));

    const result = await provider.update({ ...mutation, firstName: 'Janet', lastName: 'Roe' });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0]).toEqual({ phone: '5551234', first_name: 'Janet', last_name: 'Roe' });
    expect(result.value.firstName).toBe('Janet');
    expect(result.value.lastName).toBe('Roe');
  });

  it('leaves the names out of the update when they are not given', async () => {
    const { provider, update } = buildProvider(customer());

    const result = await provider.update(mutation);

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(update.mock.calls[0][0]).toEqual({ phone: '5551234' });
  });

  it('sends only the name that is given', async () => {
    const { provider, update } = buildProvider(customer());

    await provider.update({ ...mutation, firstName: 'Janet' });

    expect(update.mock.calls[0][0]).toEqual({ phone: '5551234', first_name: 'Janet' });
  });
});
