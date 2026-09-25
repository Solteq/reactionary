import type { RequestContext } from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoIdentityCapability } from '../capabilities/identity.capability.js';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

describe('MagentoIdentityCapability.register', () => {
  let reqCtx: RequestContext;
  let magentoApi: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    getCustomerToken: ReturnType<typeof vi.fn>;
    getActiveCartId: ReturnType<typeof vi.fn>;
  };
  let capability: MagentoIdentityCapability;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = {
      register: vi.fn().mockResolvedValue({ id: 1 }),
      login: vi.fn().mockResolvedValue(undefined),
      getCustomerToken: vi.fn().mockResolvedValue(null),
      getActiveCartId: vi.fn().mockResolvedValue(null),
    };
    capability = new MagentoIdentityCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
    );
  });

  it('sends only email/firstname/lastname for the minimal payload', async () => {
    // Extra keys pass the loose schema but are not part of the inferred type,
    // so pass a non-literal to skip the excess-property check.
    const payload = {
      username: 'jane@example.com',
      password: 'secret',
      firstname: 'Jane',
      lastname: 'Doe',
    };
    const result = await capability.register(payload);

    expect(result.success).toBe(true);
    expect(magentoApi.register).toHaveBeenCalledTimes(1);
    expect(magentoApi.register).toHaveBeenCalledWith(
      { email: 'jane@example.com', firstname: 'Jane', lastname: 'Doe' },
      'secret',
    );
    expect(magentoApi.login).toHaveBeenCalledWith('jane@example.com', 'secret');
  });

  it('keeps the firstname/lastname fallbacks when they are missing', async () => {
    await capability.register({ username: 'jane@example.com', password: 'secret' });

    expect(magentoApi.register).toHaveBeenCalledWith(
      { email: 'jane@example.com', firstname: 'User', lastname: 'Account' },
      'secret',
    );
  });

  it('forwards extra fields to the customer object without leaking username/password', async () => {
    const customAttributes = [
      { attribute_code: 'personal_identity_code', value: '010190-123A' },
    ];

    const payload = {
      username: 'jane@example.com',
      password: 'secret',
      firstname: 'Jane',
      lastname: 'Doe',
      dob: '1990-01-01',
      custom_attributes: customAttributes,
    };
    await capability.register(payload);

    expect(magentoApi.register).toHaveBeenCalledWith(
      {
        email: 'jane@example.com',
        firstname: 'Jane',
        lastname: 'Doe',
        dob: '1990-01-01',
        custom_attributes: customAttributes,
      },
      'secret',
    );
  });
});
