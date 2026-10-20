import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductAssociationSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductAssociationsCapability } from '../capabilities/product-associations.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoProduct } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'admin-token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function product(sku: string, id: number): MagentoProduct {
  return {
    id,
    sku,
    name: sku,
    status: 1,
    visibility: 4,
    custom_attributes: [{ attribute_code: 'external_id', value: `ext-${sku}` }],
  };
}

/** The `[field] → [value]` pairs of a REST search criteria query. */
function filtersOf(url: URL): Record<string, string> {
  const filters: Record<string, string> = {};
  for (let group = 0; group < 10; group++) {
    const prefix = `searchCriteria[filterGroups][${group}][filters][0]`;
    const field = url.searchParams.get(`${prefix}[field]`);
    if (!field) break;
    filters[field] = url.searchParams.get(`${prefix}[value]`) ?? '';
  }
  return filters;
}

let context: RequestContext;
let capability: MagentoProductAssociationsCapability;
let fetchMock: ReturnType<typeof vi.fn>;
let searches: Array<Record<string, string>>;
let visibleProducts: MagentoProduct[];

beforeEach(() => {
  context = createInitialRequestContext();
  searches = [];
  visibleProducts = [product('ACC-2', 12), product('ACC-1', 11)];
  fetchMock = vi.fn().mockImplementation(async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/V1/products')) {
      const filters = filtersOf(url);
      searches.push(filters);
      if (filters['external_id'] === 'ext-MAIN') {
        return json({ items: [product('MAIN', 1)], total_count: 1 });
      }
      if (filters['sku'] !== undefined && filters['status'] === '1') {
        return json({ items: visibleProducts, total_count: visibleProducts.length });
      }
      return json({ items: [], total_count: 0 });
    }
    if (url.pathname.endsWith('/V1/products/MAIN/links/related')) {
      return json([
        { sku: 'MAIN', link_type: 'related', linked_product_sku: 'ACC-1', position: 1 },
        { sku: 'MAIN', link_type: 'related', linked_product_sku: 'HIDDEN', position: 2 },
        { sku: 'MAIN', link_type: 'related', linked_product_sku: 'ACC-2', position: 3 },
      ]);
    }
    if (url.pathname.endsWith('/V1/products/MAIN/links/crosssell')) {
      return json({ message: 'boom' }, 500);
    }
    return json({ message: 'not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  capability = new MagentoProductAssociationsCapability(
    config,
    new NoOpCache(),
    context,
    new MagentoClient(config, context),
    new MagentoProductAssociationsFactory(ProductAssociationSchema, config),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MagentoProductAssociationsCapability', () => {
  it('returns the visible linked products in link position order', async () => {
    const result = await capability.getAccessories({
      forProduct: { key: 'ext-MAIN' },
      numberOfAccessories: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        result.value.map((association) =>
          association.associationReturnType === 'productSearchResultItem'
            ? association.product.identifier.key
            : association.product.key,
        ),
      ).toEqual(['ext-ACC-1', 'ext-ACC-2']);
    }
  });

  it('only loads enabled, catalog-visible linked products', async () => {
    await capability.getAccessories({
      forProduct: { key: 'ext-MAIN' },
      numberOfAccessories: 5,
    });

    const linkedSearch = searches.find((filters) => filters['sku'] !== undefined);
    expect(linkedSearch).toEqual({
      sku: 'ACC-1,HIDDEN,ACC-2',
      status: '1',
      visibility: '2,4',
    });
  });

  it('trims the result to the requested number', async () => {
    const result = await capability.getAccessories({
      forProduct: { key: 'ext-MAIN' },
      numberOfAccessories: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toHaveLength(1);
    }
  });

  it('returns NotFound for a product key that does not resolve', async () => {
    const result = await capability.getReplacements({
      forProduct: { key: 'unknown' },
      numberOfReplacements: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
    // The raw key is never used as a SKU without verifying it.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/V1/products/unknown/links'))).toBe(false);
  });

  it('returns a Generic error instead of an empty list when Magento fails', async () => {
    const result = await capability.getSpareparts({
      forProduct: { key: 'ext-MAIN' },
      numberOfSpareparts: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('validates the query', async () => {
    const result = await capability.getAccessories({
      forProduct: { key: 'ext-MAIN' },
      numberOfAccessories: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });
});
