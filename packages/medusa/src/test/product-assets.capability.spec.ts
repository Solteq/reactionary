import type { StoreProduct, StoreProductVariant } from '@medusajs/types';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductAssetSchema,
  type ProductAssetType,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MedusaProductAssetsCapability } from '../capabilities/product-assets.capability.js';
import { MedusaAPI } from '../core/client.js';
import { MedusaProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import { getMedusaTestConfiguration } from './test-utils.js';

/** Exposes the protected collection step so the test needs no Medusa HTTP client. */
class TestableProductAssetsCapability extends MedusaProductAssetsCapability {
  public exposeCollectAssets(
    product: StoreProduct,
    variantSku: string | undefined,
    types?: readonly ProductAssetType[],
  ) {
    return this.collectAssets(product, variantSku, types);
  }
}

function entry(key: string, type: ProductAssetType, title = key) {
  return {
    identifier: { key },
    type,
    title,
    files: [{ url: `https://cdn.example.com/${key}.pdf`, mimeType: 'application/pdf', language: 'en' }],
  };
}

function variant(sku: string, metadata: Record<string, unknown> | null): StoreProductVariant {
  return {
    id: `variant_${sku}`,
    title: sku,
    sku,
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
    metadata,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

function product(metadata: Record<string, unknown> | null, variants: StoreProductVariant[]): StoreProduct {
  return {
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
    external_id: 'p1',
    metadata,
    created_at: null,
    updated_at: null,
    deleted_at: null,
    variants,
    options: [],
    images: [],
  };
}

function createCapability() {
  const context = createInitialRequestContext();
  return new TestableProductAssetsCapability(
    getMedusaTestConfiguration(),
    new NoOpCache(),
    context,
    new MedusaAPI(getMedusaTestConfiguration(), context),
    new MedusaProductAssetsFactory(ProductAssetSchema),
  );
}

describe('Medusa product assets', () => {
  const capability = createCapability();

  it('returns the product-level assets from metadata', () => {
    const p = product({ assets: [entry('manual-1', 'manual'), entry('cert-1', 'certificate')] }, []);

    const result = capability.exposeCollectAssets(p, undefined);

    expect(result.map((a) => a.identifier.key)).toEqual(['manual-1', 'cert-1']);
    expect(result[0]?.files[0]?.delivery).toBe('file');
  });

  it('ignores variant assets unless a variant is requested', () => {
    const p = product(
      { assets: [entry('manual-1', 'manual')] },
      [variant('sku-1', { assets: [entry('label-1', 'energy-label')] })],
    );

    expect(capability.exposeCollectAssets(p, undefined).map((a) => a.identifier.key)).toEqual(['manual-1']);
  });

  it('adds the requested variant assets, variant version first on a key clash', () => {
    const p = product(
      { assets: [entry('manual-1', 'manual', 'product copy'), entry('cert-1', 'certificate')] },
      [
        variant('sku-1', { assets: [entry('label-1', 'energy-label'), entry('manual-1', 'manual', 'variant copy')] }),
        variant('sku-2', { assets: [entry('other-1', 'other')] }),
      ],
    );

    const result = capability.exposeCollectAssets(p, 'sku-1');

    expect(result.map((a) => a.identifier.key)).toEqual(['label-1', 'manual-1', 'cert-1']);
    expect(result.find((a) => a.identifier.key === 'manual-1')?.title).toBe('variant copy');
  });

  it('returns only product assets for an unknown variant sku', () => {
    const p = product({ assets: [entry('manual-1', 'manual')] }, [variant('sku-1', null)]);

    expect(capability.exposeCollectAssets(p, 'nope').map((a) => a.identifier.key)).toEqual(['manual-1']);
  });

  it('filters by type', () => {
    const p = product({ assets: [entry('manual-1', 'manual'), entry('vid-1', 'video')] }, []);

    expect(capability.exposeCollectAssets(p, undefined, ['video']).map((a) => a.identifier.key)).toEqual(['vid-1']);
  });

  it('skips invalid entries and keeps the valid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = product(
      {
        assets: [
          entry('manual-1', 'manual'),
          { identifier: { key: 'relative' }, type: 'manual', title: 'x', files: [{ url: '/media/x.pdf' }] },
          { identifier: { key: 'no-files' }, type: 'manual', title: 'x', files: [] },
          'not an object',
        ],
      },
      [],
    );

    const result = capability.exposeCollectAssets(p, undefined);

    expect(result.map((a) => a.identifier.key)).toEqual(['manual-1']);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('accepts the assets array stored as a JSON string', () => {
    const p = product({ assets: JSON.stringify([entry('manual-1', 'manual')]) }, []);

    expect(capability.exposeCollectAssets(p, undefined).map((a) => a.identifier.key)).toEqual(['manual-1']);
  });

  it('returns nothing for missing or malformed metadata', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(capability.exposeCollectAssets(product(null, []), undefined)).toEqual([]);
    expect(capability.exposeCollectAssets(product({ assets: 'not json' }, []), undefined)).toEqual([]);
    expect(capability.exposeCollectAssets(product({ assets: { key: 'obj' } }, []), undefined)).toEqual([]);

    warn.mockRestore();
  });
});
