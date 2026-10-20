import type { Address, RequestContext } from '@reactionary/core';
import { NoOpCache, ProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProfileCapability } from '../capabilities/profile.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import {
  type MagentoCustomer,
  MagentoProfileFactory,
} from '../factories/profile/profile.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCustomerUpdateInput } from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const SAMPLE_CUSTOMER: MagentoCustomer = {
  id: 7,
  email: 'shopper@example.com',
  firstname: 'Jane',
  lastname: 'Doe',
  created_at: '2026-08-20 10:00:00',
  updated_at: '2026-08-21 10:00:00',
  addresses: [],
};

const HOME: MagentoCustomer['addresses'] = [
  {
    id: 11,
    company: 'home',
    firstname: 'Jane',
    lastname: 'Doe',
    street: ['Main St', '1'],
    city: 'Austin',
    region: { region: 'Texas', region_code: 'TX', region_id: 57 },
    postcode: '73301',
    country_id: 'US',
    telephone: '5551234',
  },
];

const ADDRESS: Address = {
  identifier: { nickName: 'work' },
  firstName: 'Jane',
  lastName: 'Doe',
  streetAddress: 'Elm St',
  streetNumber: '2',
  city: 'Austin',
  region: 'TX',
  postalCode: '73301',
  countryCode: 'US',
};

function apiError(status: number, magentoMessage = 'failure'): MagentoApiError {
  return new MagentoApiError({
    transport: 'rest',
    status,
    method: 'GET',
    url: 'https://example.com/rest/default/V1/customers/me',
    magentoMessage,
  });
}

describe('MagentoProfileFactory', () => {
  const factory = new MagentoProfileFactory(ProfileSchema);

  it('maps customer firstname/lastname onto the profile', () => {
    const profile = factory.parseProfile(createInitialRequestContext(), SAMPLE_CUSTOMER);

    expect(profile.firstName).toBe('Jane');
    expect(profile.lastName).toBe('Doe');
  });

  it('leaves names undefined and invents no dates when Magento omits them', () => {
    const profile = factory.parseProfile(createInitialRequestContext(), {
      id: 7,
      email: 'shopper@example.com',
    });

    expect(profile.firstName).toBeUndefined();
    expect(profile.lastName).toBeUndefined();
    expect(profile.createdAt).toBe('');
    expect(profile.updatedAt).toBe('');
  });

  it('converts Magento UTC datetimes to ISO8601', () => {
    const profile = factory.parseProfile(createInitialRequestContext(), SAMPLE_CUSTOMER);

    expect(profile.createdAt).toBe('2026-08-20T10:00:00.000Z');
    expect(profile.updatedAt).toBe('2026-08-21T10:00:00.000Z');
  });

  it('derives emailVerified from the confirmation key', () => {
    const ctx = createInitialRequestContext();
    expect(factory.parseProfile(ctx, { ...SAMPLE_CUSTOMER, confirmation: null }).emailVerified).toBe(true);
    expect(factory.parseProfile(ctx, SAMPLE_CUSTOMER).emailVerified).toBe(true);
    expect(
      factory.parseProfile(ctx, { ...SAMPLE_CUSTOMER, confirmation: 'abc123' }).emailVerified,
    ).toBe(false);
  });

  it('sets both billing and shipping when one address is the default for both', () => {
    const profile = factory.parseProfile(createInitialRequestContext(), {
      ...SAMPLE_CUSTOMER,
      default_billing: '11',
      default_shipping: '11',
      addresses: HOME,
    });

    expect(profile.billingAddress?.identifier.nickName).toBe('home');
    expect(profile.shippingAddress?.identifier.nickName).toBe('home');
    expect(profile.alternateShippingAddresses).toEqual([]);
  });

  it('takes the phone from the default address telephone', () => {
    const profile = factory.parseProfile(createInitialRequestContext(), {
      ...SAMPLE_CUSTOMER,
      default_shipping: '11',
      addresses: HOME,
    });

    expect(profile.phone).toBe('5551234');
    expect(profile.phoneVerified).toBe(false);
  });

  it('reads the nickname from the configured address attribute', () => {
    const attributed = new MagentoProfileFactory(ProfileSchema, {
      addressNicknameAttribute: 'nickname',
    });
    const profile = attributed.parseProfile(createInitialRequestContext(), {
      ...SAMPLE_CUSTOMER,
      addresses: [
        {
          ...HOME?.[0],
          company: 'ACME Inc',
          custom_attributes: [{ attribute_code: 'nickname', value: 'hq' }],
        },
      ],
    });

    expect(profile.alternateShippingAddresses[0]?.identifier.nickName).toBe('hq');
  });
});

describe('MagentoProfileCapability', () => {
  let reqCtx: RequestContext;
  let client: MagentoClient;
  let capability: MagentoProfileCapability;

  function createCapability(cfg: MagentoConfiguration = config) {
    return new MagentoProfileCapability(
      cfg,
      new NoOpCache(),
      reqCtx,
      client,
      new MagentoProfileFactory(ProfileSchema, {
        addressNicknameAttribute: cfg.addressNicknameAttribute,
      }),
    );
  }

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    client = new MagentoClient(config, reqCtx);
    vi.spyOn(client, 'getCustomerToken').mockResolvedValue('customer-token');
    vi.spyOn(client, 'getMe').mockResolvedValue(SAMPLE_CUSTOMER);
    vi.spyOn(client, 'updateMe').mockImplementation(
      async (customer: MagentoCustomerUpdateInput) => ({ id: 7, ...customer }),
    );
    vi.spyOn(client, 'storefrontRequest').mockResolvedValue({
      id: 'US',
      available_regions: [
        { id: '57', code: 'TX', name: 'Texas' },
        { id: '12', code: 'CA', name: 'California' },
      ],
    });
    capability = createCapability();
  });

  describe('getById', () => {
    it('surfaces the signed-in customer', async () => {
      const result = await capability.getById({ identifier: { userId: '7' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.firstName).toBe('Jane');
        expect(result.value.lastName).toBe('Doe');
      }
    });

    it('returns NotFound for another user without fetching them', async () => {
      const result = await capability.getById({ identifier: { userId: '99' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NotFound');
      }
    });

    it('returns NotFound for an anonymous session', async () => {
      vi.spyOn(client, 'getCustomerToken').mockResolvedValue(null);

      const result = await capability.getById({ identifier: { userId: '7' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NotFound');
      }
      expect(client.getMe).not.toHaveBeenCalled();
    });

    it('returns NotFound when Magento rejects the token', async () => {
      vi.spyOn(client, 'getMe').mockRejectedValue(apiError(401));

      const result = await capability.getById({ identifier: { userId: '7' } });

      expect(!result.success && result.error.type).toBe('NotFound');
    });

    it('returns Generic for other failures', async () => {
      vi.spyOn(client, 'getMe').mockRejectedValue(apiError(500));

      const result = await capability.getById({ identifier: { userId: '7' } });

      expect(!result.success && result.error.type).toBe('Generic');
    });
  });

  describe('update', () => {
    it('forwards provided firstName/lastName to PUT /V1/customers/me', async () => {
      const result = await capability.update({
        identifier: { userId: '7' },
        email: 'shopper@example.com',
        phone: '',
        firstName: 'Janet',
        lastName: 'Smith',
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({ firstname: 'Janet', lastname: 'Smith' }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.firstName).toBe('Janet');
        expect(result.value.lastName).toBe('Smith');
      }
    });

    it('keeps the existing names when none are provided', async () => {
      await capability.update({
        identifier: { userId: '7' },
        email: 'new@example.com',
        phone: '',
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          firstname: 'Jane',
          lastname: 'Doe',
        }),
      );
    });

    it('stores the phone on the default address telephone', async () => {
      vi.spyOn(client, 'getMe').mockResolvedValue({
        ...SAMPLE_CUSTOMER,
        default_billing: '11',
        addresses: HOME,
      });

      const result = await capability.update({
        identifier: { userId: '7' },
        email: 'shopper@example.com',
        phone: '5559999',
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [expect.objectContaining({ id: 11, telephone: '5559999' })],
        }),
      );
      expect(result.success && result.value.phone).toBe('5559999');
    });

    it('rejects a new phone when there is no default address to hold it', async () => {
      const result = await capability.update({
        identifier: { userId: '7' },
        email: 'shopper@example.com',
        phone: '5559999',
      });

      expect(!result.success && result.error.type).toBe('InvalidInput');
      expect(client.updateMe).not.toHaveBeenCalled();
    });

    it('returns a typed error when Magento rejects the update', async () => {
      vi.spyOn(client, 'updateMe').mockRejectedValue(apiError(400, 'Invalid email'));

      const result = await capability.update({
        identifier: { userId: '7' },
        email: 'shopper@example.com',
        phone: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({ type: 'InvalidInput', error: 'Invalid email' });
      }
    });

    it('returns NotFound when updating another user', async () => {
      const result = await capability.update({
        identifier: { userId: '99' },
        email: 'shopper@example.com',
        phone: '',
      });

      expect(!result.success && result.error.type).toBe('NotFound');
      expect(client.updateMe).not.toHaveBeenCalled();
    });
  });

  describe('addresses', () => {
    it('resolves region_id from the country directory and uses the profile phone', async () => {
      vi.spyOn(client, 'getMe').mockResolvedValue({
        ...SAMPLE_CUSTOMER,
        default_billing: '11',
        addresses: HOME,
      });

      const result = await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: ADDRESS,
      });

      expect(result.success).toBe(true);
      expect(client.storefrontRequest).toHaveBeenCalledWith('GET', '/V1/directory/countries/US');
      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [
            expect.objectContaining({ id: 11 }),
            expect.objectContaining({
              company: 'work',
              region: { region: 'Texas', region_code: 'TX', region_id: 57 },
              region_id: 57,
              telephone: '5551234',
            }),
          ],
        }),
      );
    });

    it('does not invent a telephone placeholder', async () => {
      await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: ADDRESS,
      });

      const sent = vi.mocked(client.updateMe).mock.calls[0]?.[0];
      expect(sent?.addresses?.[0]).not.toHaveProperty('telephone');
    });

    it('sends the region text when the country has no predefined regions', async () => {
      vi.spyOn(client, 'storefrontRequest').mockResolvedValue({ id: 'DK' });

      await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: { ...ADDRESS, countryCode: 'DK', region: 'Hovedstaden' },
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [expect.objectContaining({ region: { region: 'Hovedstaden' } })],
        }),
      );
    });

    it('rejects an unknown region for a country with predefined regions', async () => {
      const result = await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: { ...ADDRESS, region: 'Atlantis' },
      });

      expect(!result.success && result.error.type).toBe('InvalidInput');
      expect(client.updateMe).not.toHaveBeenCalled();
    });

    it('returns InvalidInput for a duplicate nickname', async () => {
      vi.spyOn(client, 'getMe').mockResolvedValue({ ...SAMPLE_CUSTOMER, addresses: HOME });

      const result = await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: { ...ADDRESS, identifier: { nickName: 'home' } },
      });

      expect(!result.success && result.error.type).toBe('InvalidInput');
    });

    it('stores the nickname in the configured address attribute', async () => {
      capability = createCapability({ ...config, addressNicknameAttribute: 'nickname' });

      const result = await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: ADDRESS,
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [
            expect.objectContaining({
              custom_attributes: [{ attribute_code: 'nickname', value: 'work' }],
            }),
          ],
        }),
      );
      expect(
        result.success && result.value.alternateShippingAddresses[0]?.identifier.nickName,
      ).toBe('work');
    });

    it('keeps an address that is also default shipping when setting billing', async () => {
      vi.spyOn(client, 'getMe').mockResolvedValue({
        ...SAMPLE_CUSTOMER,
        default_billing: '11',
        default_shipping: '11',
        addresses: HOME,
      });

      await capability.setBillingAddress({
        identifier: { userId: '7' },
        address: { ...ADDRESS, identifier: { nickName: 'home' } },
      });

      expect(client.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          addresses: [
            expect.objectContaining({ id: 11, default_billing: true, default_shipping: true }),
          ],
        }),
      );
    });

    it('returns a typed error when saving an address fails', async () => {
      vi.spyOn(client, 'updateMe').mockRejectedValue(apiError(503));

      const result = await capability.addShippingAddress({
        identifier: { userId: '7' },
        address: ADDRESS,
      });

      expect(!result.success && result.error.type).toBe('Generic');
    });

    it('returns NotFound when removing an unknown address', async () => {
      const result = await capability.removeShippingAddress({
        identifier: { userId: '7' },
        addressIdentifier: { nickName: 'nope' },
      });

      expect(!result.success && result.error.type).toBe('NotFound');
    });
  });
});
