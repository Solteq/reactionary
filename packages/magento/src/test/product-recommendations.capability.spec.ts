import type { ProductRecommendation, RequestContext } from '@reactionary/core';
import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { MagentoClient } from '../core/client.js';
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

function product(sku: string, categoryIds: string[] = []): MagentoProduct {
  return {
    id: Number(sku.replace(/\D/g, '')) || 1,
    sku,
    name: sku,
    status: 1,
    visibility: 4,
    extension_attributes: {
      category_links: categoryIds.map((category_id, position) => ({
        category_id,
        position,
      })),
    },
    custom_attributes: [{ attribute_code: 'external_id', value: `ext-${sku}` }],
  };
}

interface SearchCall {
  filters: Record<string, string>;
  sortField: string | null;
  sortDirection: string | null;
  pageSize: string | null;
}

function searchOf(url: URL): SearchCall {
  const filters: Record<string, string> = {};
  for (let group = 0; group < 10; group++) {
    const prefix = `searchCriteria[filterGroups][${group}][filters][0]`;
    const field = url.searchParams.get(`${prefix}[field]`);
    if (!field) break;
    filters[field] = url.searchParams.get(`${prefix}[value]`) ?? '';
  }
  return {
    filters,
    sortField: url.searchParams.get('searchCriteria[sortOrders][0][field]'),
    sortDirection: url.searchParams.get('searchCriteria[sortOrders][0][direction]'),
    pageSize: url.searchParams.get('searchCriteria[pageSize]'),
  };
}

function keysOf(recommendations: ProductRecommendation[]): string[] {
  return recommendations.map((recommendation) =>
    recommendation.recommendationReturnType === 'productSearchResultItem'
      ? recommendation.product.identifier.key
      : recommendation.product.key,
  );
}

let context: RequestContext;
let capability: MagentoProductRecommendationsCapability;
let productSearches: SearchCall[];

beforeEach(() => {
  context = createInitialRequestContext();
  productSearches = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/V1/categories/list')) {
        const { filters } = searchOf(url);
        if (filters['url_key'] === 'summer-sale') {
          return json({ items: [{ id: 40, parent_id: 2, name: 'Summer sale' }], total_count: 1 });
        }
        if (filters['external_id'] === 'cat-tools') {
          return json({ items: [{ id: 7, parent_id: 2, name: 'Tools' }], total_count: 1 });
        }
        return json({ items: [], total_count: 0 });
      }
      if (url.pathname.endsWith('/V1/categories/8')) {
        return json({ id: 8, parent_id: 2, name: 'Garden' });
      }
      if (url.pathname.endsWith('/V1/products')) {
        const search = searchOf(url);
        productSearches.push(search);
        if (search.filters['external_id'] === 'ext-MAIN') {
          return json({ items: [product('MAIN')], total_count: 1 });
        }
        if (search.filters['category_id'] === '40') {
          return json({
            items: [product('P1', ['40']), product('P2', ['40', '7']), product('P3', ['40', '7'])],
            total_count: 3,
          });
        }
        if (search.filters['category_id'] === '7' || search.filters['category_id'] === '8') {
          return json({ items: [product('NEW1'), product('NEW2')], total_count: 2 });
        }
        if (search.filters['sku'] === 'X1,X2') {
          return json({ items: [product('X2'), product('X1')], total_count: 2 });
        }
        return json({ items: [], total_count: 0 });
      }
      if (url.pathname.endsWith('/V1/products/MAIN/links/related')) {
        return json([
          { sku: 'MAIN', link_type: 'related', linked_product_sku: 'X1', position: 0 },
          { sku: 'MAIN', link_type: 'related', linked_product_sku: 'X2', position: 1 },
        ]);
      }
      return json({ message: 'not found' }, 404);
    }),
  );
  capability = new MagentoProductRecommendationsCapability(
    config,
    new NoOpCache(),
    context,
    new MagentoClient(config, context),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MagentoProductRecommendationsCapability', () => {
  it('returns related products from the native product links', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'related',
      sourceProduct: { key: 'ext-MAIN' },
      numberOfRecommendations: 4,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(keysOf(result.value)).toEqual(['ext-X1', 'ext-X2']);
    }
    const linked = productSearches.find((search) => search.filters['sku'] === 'X1,X2');
    expect(linked?.filters).toMatchObject({ status: '1', visibility: '2,4' });
  });

  it('returns NotFound for an unresolvable source product', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'similar',
      sourceProduct: { key: 'unknown' },
      numberOfRecommendations: 4,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns the newest visible products of a category for trendingInCategory', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'trendingInCategory',
      sourceCategory: { key: 'cat-tools' },
      numberOfRecommendations: 2,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(keysOf(result.value)).toEqual(['ext-NEW1', 'ext-NEW2']);
    }
    const listing = productSearches.find((search) => search.filters['category_id'] === '7');
    expect(listing).toMatchObject({
      filters: { category_id: '7', status: '1', visibility: '2,4' },
      sortField: 'created_at',
      sortDirection: 'DESC',
    });
  });

  it('resolves a numeric category key as the Magento category id', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'trendingInCategory',
      sourceCategory: { key: '8' },
      numberOfRecommendations: 2,
    });

    expect(result.success).toBe(true);
    expect(productSearches.some((search) => search.filters['category_id'] === '8')).toBe(true);
  });

  it('returns NotFound for an unknown category instead of guessing an id', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'trendingInCategory',
      sourceCategory: { key: 'nope' },
      numberOfRecommendations: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('keeps the core default for algorithms Magento cannot back', async () => {
    const result = await capability.getRecommendations({
      algorithm: 'popular',
      numberOfRecommendations: 2,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual([]);
    }
  });

  it('returns a collection without the products already on screen', async () => {
    const result = await capability.getCollection({
      collectionName: 'summer-sale',
      sourceProduct: [{ key: 'ext-P1' }],
      numberOfRecommendations: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(keysOf(result.value)).toEqual(['ext-P2', 'ext-P3']);
    }
  });

  it('narrows a collection to the source category', async () => {
    const result = await capability.getCollection({
      collectionName: 'summer-sale',
      sourceCategory: { key: 'cat-tools' },
      numberOfRecommendations: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(keysOf(result.value)).toEqual(['ext-P2']);
    }
  });

  it('returns NotFound for an unknown collection', async () => {
    const result = await capability.getCollection({
      collectionName: 'does-not-exist',
      numberOfRecommendations: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });
});
