import type { Customer, MyCustomerUpdateAction } from '@commercetools/platform-sdk';
import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { assert, describe, expect, it } from 'vitest';
import { CommercetoolsProfileCapability } from '../capabilities/profile.capability.js';
import type { CommercetoolsAPI } from '../core/client.js';
import { CommercetoolsProfileFactory } from '../factories/profile/profile.factory.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    version: 3,
    createdAt: '2026-08-20T10:00:00Z',
    lastModifiedAt: '2026-08-21T10:00:00Z',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    addresses: [],
    shippingAddressIds: [],
    billingAddressIds: [],
    isEmailVerified: true,
    stores: [],
    authenticationMode: 'Password',
    customerGroupAssignments: [],
    ...overrides,
  };
}

describe('CommercetoolsProfileFactory names', () => {
  const factory = new CommercetoolsProfileFactory(ProfileSchema);
  const context = createInitialRequestContext();

  it('maps firstName and lastName of the customer onto the profile', () => {
    const profile = factory.parseProfile(context, customer());
    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });

  it('leaves the names undefined when the customer has none, or empty ones', () => {
    const missing = factory.parseProfile(context, customer({ firstName: undefined, lastName: undefined }));
    expect(missing.firstName).toBeUndefined();
    expect(missing.lastName).toBeUndefined();

    const empty = factory.parseProfile(context, customer({ firstName: '', lastName: '' }));
    expect(empty.firstName).toBeUndefined();
    expect(empty.lastName).toBeUndefined();
  });
});

describe('CommercetoolsProfileCapability update of the names', () => {
  function buildProvider(updated: Customer) {
    const posted: Array<{ version: number; actions: MyCustomerUpdateAction[] }> = [];
    const me = {
      get: () => ({ execute: async () => ({ body: customer() }) }),
      post: ({ body }: { body: { version: number; actions: MyCustomerUpdateAction[] } }) => {
        posted.push(body);
        return { execute: async () => ({ body: updated }) };
      },
    };
    const api = { getClient: async () => ({ withProjectKey: () => ({ me: () => me }) }) };
    const provider = new CommercetoolsProfileCapability(
      getCommercetoolsTestConfiguration(),
      new NoOpCache(),
      createInitialRequestContext(),
      api as unknown as CommercetoolsAPI,
      new CommercetoolsProfileFactory(ProfileSchema),
    );
    return { provider, posted };
  }

  const mutation = { identifier: { userId: 'cust-1' }, email: 'jane@example.com', phone: '5551234' };
  const nameActions = (actions: MyCustomerUpdateAction[]) => actions.filter((a) => a.action === 'setFirstName' || a.action === 'setLastName');

  it('sets the names with the update and returns them on the profile', async () => {
    const { provider, posted } = buildProvider(customer({ firstName: 'Janet', lastName: 'Roe', version: 4 }));

    const result = await provider.update({ ...mutation, firstName: 'Janet', lastName: 'Roe' });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(posted).toHaveLength(1);
    expect(posted[0].version).toBe(3);
    expect(nameActions(posted[0].actions)).toEqual([
      { action: 'setFirstName', firstName: 'Janet' },
      { action: 'setLastName', lastName: 'Roe' },
    ]);
    expect(result.value.firstName).toBe('Janet');
    expect(result.value.lastName).toBe('Roe');
  });

  it('adds no name actions when the names are not given', async () => {
    const { provider, posted } = buildProvider(customer());

    const result = await provider.update(mutation);

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(nameActions(posted[0].actions)).toEqual([]);
  });

  it('sets only the name that is given', async () => {
    const { provider, posted } = buildProvider(customer());

    await provider.update({ ...mutation, lastName: 'Roe' });

    expect(nameActions(posted[0].actions)).toEqual([{ action: 'setLastName', lastName: 'Roe' }]);
  });
});
