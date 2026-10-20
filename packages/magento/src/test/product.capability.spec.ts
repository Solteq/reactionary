import { MemoryCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MagentoProductCapability } from '../capabilities/product.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoProductFactory } from '../factories/product/product.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoProduct, MagentoProductSearchResult } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
});

function apiError(status: number): MagentoApiError {
  return new MagentoApiError({ transport: 'rest', status, method: 'GET', url: 'https://shop.example.com/rest/V1' });
}

function product(partial: Partial<MagentoProduct> = {}): MagentoProduct {
  return {
    id: 10,
    sku: 'MH01',
    name: 'Hoodie',
    status: 1,
    visibility: 4,
    type_id: 'simple',
    attribute_set_id: 4,
    custom_attributes: [{ attribute_code: 'external_id', value: 'P-1' }],
    ...partial,
  };
}

function page(items: MagentoProduct[]): MagentoProductSearchResult {
  return { items, total_count: items.length };
}

const ATTRIBUTE_SET = [
  { attribute_id: 93, attribute_code: 'color', frontend_input: 'select', default_frontend_label: 'Color', is_visible_on_front: '0', options: [{ label: ' ', value: '' }, { label: 'Red', value: '49' }] },
];

describe('MagentoProductCapability', () => {
  let client: MagentoClient;
  let capability: MagentoProductCapability;
  let searchProducts: MockInstance<MagentoClient['searchProducts']>;
  let catalogRequest: MockInstance<MagentoClient['catalogRequest']>;

  beforeEach(() => {
    const context = createInitialRequestContext();
    client = new MagentoClient(config, context);
    searchProducts = vi.spyOn(client, 'searchProducts').mockResolvedValue(page([]));
    catalogRequest = vi.spyOn(client, 'catalogRequest').mockImplementation(async (path: string) => {
      if (path.startsWith('/V1/products/attribute-sets/')) return ATTRIBUTE_SET;
      if (path.startsWith('/V1/categories/list')) return { items: [], total_count: 0 };
      throw apiError(404);
    });
    capability = new MagentoProductCapability(
      config,
      new MemoryCache(),
      context,
      client,
      new MagentoProductFactory(ProductSchema, config),
    );
  });

  function sentParams(callIndex = 0): Record<string, string> {
    const params = searchProducts.mock.calls[callIndex]?.[0];
    return params ? Object.fromEntries(params.entries()) : {};
  }

  describe('getById', () => {
    it('matches the key on external_id or entity_id, restricted to enabled products with a PDP', async () => {
      searchProducts.mockResolvedValue(page([product()]));

      const result = await capability.getById({ identifier: { key: 'P-1' } });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.value.identifier.key).toBe('P-1');
      expect(sentParams()).toMatchObject({
        'searchCriteria[filterGroups][0][filters][0][field]': 'external_id',
        'searchCriteria[filterGroups][0][filters][0][value]': 'P-1',
        'searchCriteria[filterGroups][1][filters][0][field]': 'status',
        'searchCriteria[filterGroups][1][filters][0][value]': '1',
        'searchCriteria[filterGroups][2][filters][0][field]': 'visibility',
        'searchCriteria[filterGroups][2][filters][0][value]': '2,3,4',
        'searchCriteria[filterGroups][2][filters][0][condition_type]': 'in',
      });
      // A non-numeric key cannot be an entity id.
      expect(sentParams()['searchCriteria[filterGroups][0][filters][1][field]']).toBeUndefined();
    });

    it('accepts a numeric key as entity id only for products without external_id', async () => {
      searchProducts.mockResolvedValue(
        page([product({ id: 42, custom_attributes: [{ attribute_code: 'external_id', value: 'OTHER' }] })]),
      );
      const shadowed = await capability.getById({ identifier: { key: '42' } });
      expect(sentParams()['searchCriteria[filterGroups][0][filters][1][field]']).toBe('entity_id');
      expect(shadowed.success).toBe(false);
      if (!shadowed.success) expect(shadowed.error.type).toBe('NotFound');

      searchProducts.mockResolvedValue(page([product({ id: 42, custom_attributes: [] })]));
      const plain = await capability.getById({ identifier: { key: '42' } });
      expect(plain.success).toBe(true);
    });

    it('returns NotFound instead of an empty product when nothing matches', async () => {
      const result = await capability.getById({ identifier: { key: 'missing' } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    });

    it('returns a Generic error when Magento fails', async () => {
      searchProducts.mockRejectedValue(apiError(500));
      const result = await capability.getById({ identifier: { key: 'P-1' } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');
    });
  });

  describe('getBySlug', () => {
    it('does not mask an authorisation failure as NotFound', async () => {
      searchProducts.mockRejectedValue(apiError(401));
      const result = await capability.getBySlug({ slug: 'hoodie' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');
    });

    it('returns NotFound for a slug outside the storefront scope', async () => {
      const result = await capability.getBySlug({ slug: 'hoodie' });
      expect(sentParams()).toMatchObject({
        'searchCriteria[filterGroups][0][filters][0][field]': 'url_key',
        'searchCriteria[filterGroups][1][filters][0][field]': 'status',
        'searchCriteria[filterGroups][2][filters][0][field]': 'visibility',
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    });
  });

  describe('getBySKU', () => {
    it('returns NotFound for an unknown SKU', async () => {
      vi.spyOn(client, 'getProductBySKU').mockRejectedValue(apiError(404));
      const result = await capability.getBySKU({ variant: { sku: 'nope' } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    });

    it('returns NotFound for a disabled product', async () => {
      vi.spyOn(client, 'getProductBySKU').mockResolvedValue(product({ status: 2 }));
      const result = await capability.getBySKU({ variant: { sku: 'MH01' } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    });

    it('loads the enabled children and options of a configurable product', async () => {
      vi.spyOn(client, 'getProductBySKU').mockResolvedValue(product({ type_id: 'configurable' }));
      const children = vi.spyOn(client, 'getConfigurableChildren').mockResolvedValue([
        product({ sku: 'MH01-Red', visibility: 1, custom_attributes: [{ attribute_code: 'color', value: '49' }] }),
        product({ sku: 'MH01-Off', status: 2, visibility: 1 }),
      ]);
      vi.spyOn(client, 'getConfigurableOptions').mockResolvedValue([
        { attribute_id: '93', label: 'Color', values: [{ value_index: 49 }] },
      ]);

      const result = await capability.getBySKU({ variant: { sku: 'MH01' } });

      expect(children).toHaveBeenCalledWith('MH01');
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.value.mainVariant.identifier.sku).toBe('MH01-Red');
      expect(result.value.variants).toEqual([]);
      expect(result.value.options).toEqual([
        {
          identifier: { key: 'color' },
          name: 'Color',
          values: [{ identifier: { option: { key: 'color' }, key: '49' }, label: 'Red' }],
        },
      ]);
    });

    it('caches the attribute set metadata', async () => {
      vi.spyOn(client, 'getProductBySKU').mockResolvedValue(product());
      await capability.getBySKU({ variant: { sku: 'MH01' } });
      await capability.getBySKU({ variant: { sku: 'MH01' } });
      const attributeSetCalls = catalogRequest.mock.calls.filter(([path]) =>
        path.startsWith('/V1/products/attribute-sets/'),
      );
      expect(attributeSetCalls).toHaveLength(1);
    });
  });
});
