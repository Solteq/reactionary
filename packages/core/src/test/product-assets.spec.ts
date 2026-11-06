import { describe, expect, it } from 'vitest';
import { NoOpCache } from '../cache/noop-cache.js';
import { ProductAssetsCapability } from '../capabilities/product-assets.capability.js';
import { createInitialRequestContext } from '../initialization.js';
import {
  ProductAssetSchema,
  ProductAssetFileSchema,
  type ProductAsset,
  type ProductAssetType,
} from '../schemas/models/product-assets.model.js';
import { ProductAssetsGetQuerySchema } from '../schemas/queries/product-assets.query.js';
import { success } from '../schemas/result.js';

class TestProductAssetsCapability extends ProductAssetsCapability {
  public override async getAssets() {
    return success<ProductAsset[]>([]);
  }
  public map(vendorType: string | undefined, typeMap: Record<string, ProductAssetType>) {
    return this.mapVendorType(vendorType, typeMap);
  }
  public dedupe(assets: ProductAsset[]) {
    return this.dedupeAssets(assets);
  }
  public filter(assets: ProductAsset[], types: ProductAssetType[] | undefined) {
    return this.filterByTypes(assets, types);
  }
}

function asset(key: string, type: ProductAssetType = 'manual'): ProductAsset {
  return ProductAssetSchema.parse({
    identifier: { key },
    type,
    title: key,
    files: [{ url: `https://cdn.example.com/${key}.pdf`, mimeType: 'application/pdf' }],
  });
}

describe('ProductAssetFileSchema', () => {
  it('defaults delivery to file and mimeType to empty', () => {
    const file = ProductAssetFileSchema.parse({ url: 'https://cdn.example.com/a.pdf' });
    expect(file.delivery).toBe('file');
    expect(file.mimeType).toBe('');
  });

  it('rejects relative urls', () => {
    expect(ProductAssetFileSchema.safeParse({ url: '/media/a.pdf' }).success).toBe(false);
  });

  it('rejects schemes other than http and https', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://host.example.com/a.pdf']) {
      expect(ProductAssetFileSchema.safeParse({ url }).success).toBe(false);
    }
    expect(ProductAssetFileSchema.safeParse({ url: 'http://cdn.example.com/a.pdf' }).success).toBe(true);
  });

  it('accepts an embed with a provider hint', () => {
    const file = ProductAssetFileSchema.parse({
      url: 'https://www.youtube.com/embed/abc',
      delivery: 'embed',
      embedProvider: 'youtube',
    });
    expect(file.delivery).toBe('embed');
    expect(file.embedProvider).toBe('youtube');
  });
});

describe('ProductAssetSchema', () => {
  it('requires at least one file', () => {
    const result = ProductAssetSchema.safeParse({ identifier: { key: 'a' }, type: 'manual', title: 'A', files: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown type', () => {
    const result = ProductAssetSchema.safeParse({
      identifier: { key: 'a' },
      type: 'brochure',
      title: 'A',
      files: [{ url: 'https://cdn.example.com/a.pdf' }],
    });
    expect(result.success).toBe(false);
  });

  it('keeps renditions of one asset together', () => {
    const parsed = ProductAssetSchema.parse({
      identifier: { key: 'model-1' },
      type: '3d-model',
      title: 'Chair',
      files: [
        { url: 'https://cdn.example.com/chair.glb', mimeType: 'model/gltf-binary' },
        { url: 'https://cdn.example.com/chair.usdz', mimeType: 'model/vnd.usdz+zip' },
      ],
    });
    expect(parsed.files).toHaveLength(2);
  });
});

describe('ProductAssetsGetQuerySchema', () => {
  it('needs only the product', () => {
    expect(ProductAssetsGetQuerySchema.safeParse({ forProduct: { key: 'p1' } }).success).toBe(true);
  });

  it('accepts a variant and a type filter', () => {
    const result = ProductAssetsGetQuerySchema.safeParse({
      forProduct: { key: 'p1' },
      forVariant: { sku: 'sku-1' },
      types: ['manual', 'video'],
    });
    expect(result.success).toBe(true);
  });
});

describe('ProductAssetsCapability helpers', () => {
  const capability = new TestProductAssetsCapability(new NoOpCache(), createInitialRequestContext());

  it('maps a known vendor type and keeps the raw value', () => {
    expect(capability.map('MANUAL', { MANUAL: 'manual' })).toEqual({ type: 'manual', vendorType: 'MANUAL' });
  });

  it('maps an unknown vendor type to other and keeps the raw value', () => {
    expect(capability.map('LEAFLET', { MANUAL: 'manual' })).toEqual({ type: 'other', vendorType: 'LEAFLET' });
  });

  it('does not resolve inherited object keys as vendor types', () => {
    expect(capability.map('constructor', {})).toEqual({ type: 'other', vendorType: 'constructor' });
  });

  it('maps a missing vendor type to other', () => {
    expect(capability.map(undefined, { MANUAL: 'manual' })).toEqual({ type: 'other', vendorType: undefined });
  });

  it('dedupes by identifier key, first occurrence wins', () => {
    const first = asset('a');
    const second = { ...asset('a'), title: 'second' };
    const result = capability.dedupe([first, asset('b'), second]);
    expect(result.map((a) => a.identifier.key)).toEqual(['a', 'b']);
    expect(result[0].title).toBe('a');
  });

  it('filters by type, and returns everything without a filter', () => {
    const assets = [asset('a', 'manual'), asset('b', 'video'), asset('c', 'certificate')];
    expect(capability.filter(assets, ['video', 'certificate']).map((a) => a.identifier.key)).toEqual(['b', 'c']);
    expect(capability.filter(assets, undefined)).toHaveLength(3);
    expect(capability.filter(assets, [])).toHaveLength(3);
  });

  it('names its resource', () => {
    expect(capability.getResourceName()).toBe('product-assets');
  });
});
