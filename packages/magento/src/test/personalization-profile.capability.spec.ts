import type { RequestContext } from '@reactionary/core';
import { NoOpCache, PersonalizationProfileSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const baseConfig: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

describe('MagentoPersonalizationProfileCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: {
    getMe: ReturnType<typeof vi.fn>;
    adminRequest: ReturnType<typeof vi.fn>;
    graphqlRequest: ReturnType<typeof vi.fn>;
    getActiveCartId: ReturnType<typeof vi.fn>;
  };

  function create(config: MagentoConfiguration = baseConfig) {
    return new MagentoPersonalizationProfileCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoPersonalizationProfileFactory(PersonalizationProfileSchema),
    );
  }

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = {
      getMe: vi.fn(),
      adminRequest: vi.fn(),
      graphqlRequest: vi.fn(),
      getActiveCartId: vi.fn().mockResolvedValue(null),
    };
  });

  it('puts guests in the NOT LOGGED IN group without calling Magento', async () => {
    const result = await create().getPersonalizationProfile({ identity: { type: 'Anonymous' } });

    expect(magentoApi.getMe).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.identifier.key).toBe('anonymous');
      expect(result.value.segments).toEqual(['customer-group:0']);
      expect(result.value.blurb).toContain('Guest');
    }
  });

  it('uses the signed-in customer group', async () => {
    magentoApi.getMe.mockResolvedValue({ id: 7, group_id: 2, email: 'a@b.c' });

    const result = await create().getPersonalizationProfile({
      identity: { type: 'Registered', id: { userId: '7' } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.identifier.key).toBe('7');
      expect(result.value.segments).toEqual(['customer-group:2']);
    }
    expect(magentoApi.adminRequest).not.toHaveBeenCalled();
  });

  it('resolves group codes and segments when configured', async () => {
    magentoApi.getMe.mockResolvedValue({ id: 7, group_id: 2, email: 'a@b.c' });
    magentoApi.adminRequest.mockResolvedValue({ id: 2, code: 'Wholesale' });
    magentoApi.getActiveCartId.mockResolvedValue('maskedCartId');
    magentoApi.graphqlRequest.mockResolvedValue({ customerSegments: [{ uid: 'Ng==' }, { uid: 'not-base64!' }] });

    const result = await create({
      ...baseConfig,
      personalizationResolveGroupCodes: true,
      personalizationIncludeSegments: true,
    }).getPersonalizationProfile({ identity: { type: 'Registered', id: { userId: '7' } } });

    expect(magentoApi.adminRequest).toHaveBeenCalledWith('GET', '/V1/customerGroups/2');
    expect(magentoApi.graphqlRequest).toHaveBeenCalledWith(expect.any(String), { cartId: 'maskedCartId' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.segments).toEqual([
        'customer-group:Wholesale',
        'customer-segment:6',
        'customer-segment:not-base64!',
      ]);
      expect(result.value.blurb).toContain('Wholesale');
    }
  });

  it('skips segments when the session cart id is not a masked id', async () => {
    magentoApi.getMe.mockResolvedValue({ id: 7, group_id: 1, email: 'a@b.c' });
    magentoApi.getActiveCartId.mockResolvedValue('123');

    const result = await create({ ...baseConfig, personalizationIncludeSegments: true }).getPersonalizationProfile({
      identity: { type: 'Registered', id: { userId: '7' } },
    });

    expect(magentoApi.graphqlRequest).not.toHaveBeenCalled();
    expect(result.success && result.value.segments).toEqual(['customer-group:1']);
  });

  it('returns NotFound when the identity does not match the token owner', async () => {
    magentoApi.getMe.mockResolvedValue({ id: 8, group_id: 1, email: 'a@b.c' });

    const result = await create().getPersonalizationProfile({
      identity: { type: 'Registered', id: { userId: '7' } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a typed error when Magento fails', async () => {
    magentoApi.getMe.mockRejectedValue(new Error('boom'));

    const result = await create().getPersonalizationProfile({
      identity: { type: 'Registered', id: { userId: '7' } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });
});
