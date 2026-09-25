import type { RequestContext } from '@reactionary/core';
import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProfileCapability } from '../capabilities/profile.capability.js';
import type { MagentoClient } from '../core/client.js';
import {
  type MagentoCustomer,
  MagentoProfileFactory,
} from '../factories/profile/profile.factory.js';
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

const SAMPLE_CUSTOMER: MagentoCustomer = {
  id: 7,
  email: 'shopper@example.com',
  firstname: 'Jane',
  lastname: 'Doe',
  created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-21T10:00:00Z',
  addresses: [],
  custom_attributes: [{ attribute_code: 'phone', value: '5551234' }],
};

describe('MagentoProfileFactory', () => {
  it('maps customer firstname/lastname onto the profile', () => {
    const factory = new MagentoProfileFactory(ProfileSchema);

    const profile = factory.parseProfile(createInitialRequestContext(), SAMPLE_CUSTOMER);

    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });

  it('leaves names undefined when Magento omits them', () => {
    const factory = new MagentoProfileFactory(ProfileSchema);

    const profile = factory.parseProfile(createInitialRequestContext(), {
      id: 7,
      email: 'shopper@example.com',
    });

    expect(profile.firstName).toBeUndefined();
    expect(profile.lastName).toBeUndefined();
  });
});

describe('MagentoProfileCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: {
    getMe: ReturnType<typeof vi.fn>;
    updateMe: ReturnType<typeof vi.fn>;
  };
  let capability: MagentoProfileCapability;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = {
      getMe: vi.fn().mockResolvedValue(SAMPLE_CUSTOMER),
      updateMe: vi.fn(async (customer: MagentoCustomer) => customer),
    };
    capability = new MagentoProfileCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoProfileFactory(ProfileSchema),
    );
  });

  it('getById surfaces the customer names', async () => {
    const result = await capability.getById({ identifier: { userId: '7' } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.firstName).toBe('Jane');
      expect(result.value.lastName).toBe('Doe');
    }
  });

  it('update forwards provided firstName/lastName to PUT /V1/customers/me', async () => {
    const result = await capability.update({
      identifier: { userId: '7' },
      email: 'shopper@example.com',
      phone: '5551234',
      firstName: 'Janet',
      lastName: 'Smith',
    });

    expect(magentoApi.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ firstname: 'Janet', lastname: 'Smith' }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.firstName).toBe('Janet');
      expect(result.value.lastName).toBe('Smith');
    }
  });

  it('update keeps the existing names when none are provided', async () => {
    await capability.update({
      identifier: { userId: '7' },
      email: 'new@example.com',
      phone: '5551234',
    });

    expect(magentoApi.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        firstname: 'Jane',
        lastname: 'Doe',
      }),
    );
  });
});
