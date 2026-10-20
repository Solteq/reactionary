import type { StoreProduct, StoreProductVariant } from '@medusajs/types';
import { createInitialRequestContext, NoOpCache, ProductAssociationSchema, ProductSearchQueryByTermSchema, ProductSearchResultSchema, type ProductSearchResultItem } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaAPI } from '../core/client.js';
import { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MedusaProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import { MedusaProductRecommendationsCapability } from '../capabilities/product-recommendations.capability.js';
import { getMedusaTestConfiguration } from './test-utils.js';

/**
 * Exposes the protected parseSearchResultItem extension point so the test can
 * exercise parseVariant without mocking the Medusa HTTP client.
 */
class TestableProductRecommendationsCapability extends MedusaProductRecommendationsCapability {
  public exposeParseSearchResultItem(product: StoreProduct): ProductSearchResultItem {
    return this.parseSearchResultItem(product);
  }
}

// A variant belonging to a product that has no images at all - `images` comes
// back from Medusa as `[]`, not undefined, so `product.images?.[0]` is
// `undefined` and `.url` on that used to throw.
const variant: StoreProductVariant = {
  id: 'variant_1',
  title: 'Test variant',
  sku: 'TEST-SKU',
  barcode: null,
  ean: null,
  upc: null,
  thumbnail: null,
  allow_backorder: null,
  manage_inventory: null,
  hs_code: null,
  origin_country: null,
  mid_code: null,
  material: null,
  weight: null,
  length: null,
  height: null,
  width: null,
  options: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

const productWithoutImages: StoreProduct = {
  id: 'prod_1',
  title: 'Test product',
  handle: 'test-product',
  subtitle: null,
  description: null,
  is_giftcard: false,
  status: 'published',
  thumbnail: null,
  width: null,
  weight: null,
  length: null,
  height: null,
  origin_country: null,
  hs_code: null,
  mid_code: null,
  material: null,
  collection_id: null,
  type_id: null,
  discountable: true,
  external_id: null,
  created_at: null,
  updated_at: null,
  deleted_at: null,
  variants: [variant],
  options: [],
  images: [],
};

describe('Medusa product image fallback (reactionary-cnq.6)', () => {
  it('product-search factory does not crash when images is an empty array', () => {
    const factory = new MedusaProductSearchFactory(ProductSearchResultSchema);

    const result = factory.parseSearchResult(
      createInitialRequestContext(),
      { products: [productWithoutImages], count: 1, offset: 0, limit: 10 },
      ProductSearchQueryByTermSchema.parse({
        search: {
          term: 'test',
          paginationOptions: { pageNumber: 1, pageSize: 10 },
          facets: [],
          filters: [],
        },
      }),
    );

    expect(result.items[0]?.variants[0]?.image).toEqual({
      sourceUrl: '',
      altText: 'Test product',
    });
  });

  it('product-associations factory does not crash when images is an empty array', () => {
    const factory = new MedusaProductAssociationsFactory(ProductAssociationSchema);

    const result = factory.parseAssociation(createInitialRequestContext(), {
      product: productWithoutImages,
      identifier: { key: 'assoc_1' },
    });

    expect(result.associationReturnType).toBe('productSearchResultItem');
    if (result.associationReturnType === 'productSearchResultItem') {
      expect(result.product.variants[0]?.image).toEqual({
        sourceUrl: '',
        altText: 'Test product',
      });
    }
  });

  it('product-recommendations capability does not crash when images is an empty array', () => {
    const reqCtx = createInitialRequestContext();
    const client = new MedusaAPI(getMedusaTestConfiguration(), reqCtx);
    const capability = new TestableProductRecommendationsCapability(
      getMedusaTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      client,
    );

    const result = capability.exposeParseSearchResultItem(productWithoutImages);

    expect(result.variants[0]?.image).toEqual({
      sourceUrl: '',
      altText: 'Test product',
    });
  });
});
