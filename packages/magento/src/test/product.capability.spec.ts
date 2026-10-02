import type { RequestContext } from '@reactionary/core';
import { NoOpCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductCapability } from '../capabilities/product.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoProductFactory } from '../factories/product/product.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoProduct } from '../schema/magento.types.js';

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

const RAW_PRODUCT: MagentoProduct = {
  id: 1234,
  sku: 'SKU-1',
  name: 'Sample product',
  custom_attributes: [{ attribute_code: 'url_key', value: 'sample-product' }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function searchedField(call: unknown[]): string | null {
  const url = new URL(String(call[0]));
  return url.searchParams.get('searchCriteria[filterGroups][0][filters][0][field]');
}

describe('MagentoProductCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: { getProductBySKU: ReturnType<typeof vi.fn> };
  let capability: MagentoProductCapability;
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    magentoApi = { getProductBySKU: vi.fn() };
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    capability = new MagentoProductCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoProductFactory(ProductSchema, config),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getById', () => {
    it('resolves the product by external_id when the store populates it', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              ...RAW_PRODUCT,
              custom_attributes: [
                ...(RAW_PRODUCT.custom_attributes ?? []),
                { attribute_code: 'external_id', value: 'EXT-1' },
              ],
            },
          ],
        }),
      );

      const result = await capability.getById({ identifier: { key: 'EXT-1' } });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(searchedField(fetchSpy.mock.calls[0])).toBe('external_id');
      expect(magentoApi.getProductBySKU).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('EXT-1');
        expect(result.value.mainVariant.identifier.sku).toBe('SKU-1');
      }
    });

    it('falls back to entity_id for an all-digit key without an external_id match', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ items: [] }))
        .mockResolvedValueOnce(jsonResponse({ items: [RAW_PRODUCT] }));

      const result = await capability.getById({ identifier: { key: '1234' } });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(searchedField(fetchSpy.mock.calls[0])).toBe('external_id');
      expect(searchedField(fetchSpy.mock.calls[1])).toBe('entity_id');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('1234');
        expect(result.value.mainVariant.identifier.sku).toBe('SKU-1');
      }
    });

    it('falls back to a SKU lookup for a non-numeric key without an external_id match', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [] }));
      magentoApi.getProductBySKU.mockResolvedValue(RAW_PRODUCT);

      const result = await capability.getById({ identifier: { key: 'SKU-1' } });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(magentoApi.getProductBySKU).toHaveBeenCalledWith('SKU-1', { allowNotFound: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.mainVariant.identifier.sku).toBe('SKU-1');
      }
    });

    it('treats a 400 on the external_id filter as no match and continues the chain', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          jsonResponse({ message: 'Invalid attribute name: external_id' }, 400),
        )
        .mockResolvedValueOnce(jsonResponse({ items: [RAW_PRODUCT] }));

      const result = await capability.getById({ identifier: { key: '1234' } });

      expect(searchedField(fetchSpy.mock.calls[1])).toBe('entity_id');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.mainVariant.identifier.sku).toBe('SKU-1');
      }
    });

    it('returns an empty product when every lookup misses', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [] }));
      magentoApi.getProductBySKU.mockResolvedValue(undefined);

      const result = await capability.getById({ identifier: { key: 'NOPE' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('NOPE');
        expect(result.value.mainVariant.identifier.sku).toBe('');
      }
    });

    it('returns an empty product when an all-digit key misses on entity_id', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ items: [] }))
        .mockResolvedValueOnce(jsonResponse({ items: [] }));

      const result = await capability.getById({ identifier: { key: '999' } });

      expect(magentoApi.getProductBySKU).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('999');
        expect(result.value.mainVariant.identifier.sku).toBe('');
      }
    });

    it('surfaces a server failure as an error instead of an empty product', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, 500));

      const result = await capability.getById({ identifier: { key: '1234' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('Generic');
      }
    });

    it('surfaces a failed SKU lookup as an error instead of an empty product', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [] }));
      magentoApi.getProductBySKU.mockRejectedValue(new Error('network down'));

      const result = await capability.getById({ identifier: { key: 'SKU-1' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('Generic');
      }
    });
  });

  describe('getBySlug', () => {
    it('returns the product matching the url_key', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [RAW_PRODUCT] }));

      const result = await capability.getBySlug({ slug: 'sample-product' });

      expect(searchedField(fetchSpy.mock.calls[0])).toBe('url_key');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.slug).toBe('sample-product');
      }
    });

    it('returns NotFound when the search result is empty', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ items: [] }));

      const result = await capability.getBySlug({ slug: 'missing' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'NotFound', identifier: { slug: 'missing' } });
      }
    });

    it('surfaces a server failure as an error, not NotFound', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, 500));

      const result = await capability.getBySlug({ slug: 'sample-product' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('Generic');
      }
    });
  });
});
