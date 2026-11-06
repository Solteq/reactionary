import type { Asset, ProductProjection } from '@commercetools/platform-sdk';
import {
  createInitialRequestContext,
  NoOpCache,
  ProductAssetSchema,
  type ProductAssetType,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { CommercetoolsProductAssetsCapability } from '../capabilities/product-assets.capability.js';
import { CommercetoolsAPI } from '../core/client.js';
import { CommercetoolsProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';

/** Exposes the protected collection step so the test needs no commercetools HTTP client. */
class TestableProductAssetsCapability extends CommercetoolsProductAssetsCapability {
  public exposeCollectAssets(
    projection: ProductProjection,
    variantSku: string | undefined,
    types?: readonly ProductAssetType[],
  ) {
    return this.collectAssets(projection, variantSku, types);
  }
}

function asset(
  key: string,
  tags: string[],
  sources: Asset['sources'] = [{ uri: `https://cdn.example.com/${key}.pdf`, contentType: 'application/pdf' }],
  name: Asset['name'] = { en: key },
): Asset {
  return { id: `id-${key}`, key, name, tags, sources };
}

function projection(
  masterAssets: Asset[] | undefined,
  variants: { sku: string; assets: Asset[] }[] = [],
): ProductProjection {
  return {
    id: 'id-1',
    version: 1,
    key: 'p1',
    productType: { typeId: 'product-type', id: 'pt-1' },
    name: { en: 'Product' },
    slug: { en: 'product' },
    categories: [],
    masterVariant: { id: 1, sku: 'master-sku', images: [], attributes: [], assets: masterAssets },
    variants: variants.map((v, i) => ({ id: i + 2, sku: v.sku, images: [], attributes: [], assets: v.assets })),
    attributes: [],
    hasStagedChanges: false,
    published: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModifiedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createCapability(config: CommercetoolsConfiguration = getCommercetoolsTestConfiguration(), locale = 'en-US') {
  const context = createInitialRequestContext();
  context.languageContext.locale = locale;
  return new TestableProductAssetsCapability(
    config,
    new NoOpCache(),
    context,
    new CommercetoolsAPI(config, context),
    new CommercetoolsProductAssetsFactory(ProductAssetSchema),
  );
}

describe('Commercetools product assets', () => {
  it('returns the master variant assets as product-level assets', () => {
    const capability = createCapability();
    const p = projection([asset('manual-1', ['manual', 'lang:en']), asset('cert-1', ['certificate'])]);

    const result = capability.exposeCollectAssets(p, undefined);

    expect(result.map((a) => a.identifier.key)).toEqual(['manual-1', 'cert-1']);
    expect(result[0]?.type).toBe('manual');
    expect(result[0]?.vendorType).toBe('manual');
    expect(result[0]?.files).toEqual([
      { url: 'https://cdn.example.com/manual-1.pdf', mimeType: 'application/pdf', delivery: 'file', language: 'en' },
    ]);
  });

  it('keeps all sources of an asset as renditions', () => {
    const capability = createCapability();
    const model = asset('chair', ['3d-model'], [
      { uri: 'https://cdn.example.com/chair.glb', contentType: 'model/gltf-binary' },
      { uri: 'https://cdn.example.com/chair.usdz', contentType: 'model/vnd.usdz+zip' },
    ]);

    const result = capability.exposeCollectAssets(projection([model]), undefined);

    expect(result[0]?.type).toBe('3d-model');
    expect(result[0]?.files.map((f) => f.mimeType)).toEqual(['model/gltf-binary', 'model/vnd.usdz+zip']);
  });

  it('adds the requested variant assets, variant version first on a key clash', () => {
    const capability = createCapability();
    const p = projection(
      [asset('manual-1', ['manual'], undefined, { en: 'master copy' }), asset('cert-1', ['certificate'])],
      [
        { sku: 'sku-1', assets: [asset('label-1', ['energy-label']), asset('manual-1', ['manual'], undefined, { en: 'variant copy' })] },
        { sku: 'sku-2', assets: [asset('other-1', ['other'])] },
      ],
    );

    const result = capability.exposeCollectAssets(p, 'sku-1');

    expect(result.map((a) => a.identifier.key)).toEqual(['label-1', 'manual-1', 'cert-1']);
    expect(result.find((a) => a.identifier.key === 'manual-1')?.title).toBe('variant copy');
  });

  it('ignores variant assets unless the variant is requested, and tolerates an unknown or master sku', () => {
    const capability = createCapability();
    const p = projection([asset('manual-1', ['manual'])], [{ sku: 'sku-1', assets: [asset('label-1', ['energy-label'])] }]);

    expect(capability.exposeCollectAssets(p, undefined).map((a) => a.identifier.key)).toEqual(['manual-1']);
    expect(capability.exposeCollectAssets(p, 'nope').map((a) => a.identifier.key)).toEqual(['manual-1']);
    expect(capability.exposeCollectAssets(p, 'master-sku').map((a) => a.identifier.key)).toEqual(['manual-1']);
  });

  it('maps unmapped tags to other and keeps the first plain tag as vendorType', () => {
    const capability = createCapability();

    const result = capability.exposeCollectAssets(projection([asset('x', ['lang:da', 'brochure'])]), undefined);

    expect(result[0]?.type).toBe('other');
    expect(result[0]?.vendorType).toBe('brochure');
    expect(result[0]?.files[0]?.language).toBe('da');
  });

  it('treats an asset without tags as other with no vendorType', () => {
    const capability = createCapability();

    const result = capability.exposeCollectAssets(projection([asset('x', [])]), undefined);

    expect(result[0]?.type).toBe('other');
    expect(result[0]?.vendorType).toBeUndefined();
  });

  it('uses the configured tag map and language prefix', () => {
    const config: CommercetoolsConfiguration = {
      ...getCommercetoolsTestConfiguration(),
      productAssets: { tagTypeMap: { 'ICECAT:manual pdf': 'manual' }, languageTagPrefix: 'language-' },
    };
    const capability = createCapability(config);

    const result = capability.exposeCollectAssets(
      projection([asset('x', ['language-de', 'ICECAT:manual pdf'])]),
      undefined,
    );

    expect(result[0]?.type).toBe('manual');
    expect(result[0]?.vendorType).toBe('ICECAT:manual pdf');
    expect(result[0]?.files[0]?.language).toBe('de');
  });

  it('does not resolve inherited object keys as tags', () => {
    const capability = createCapability();

    expect(capability.exposeCollectAssets(projection([asset('x', ['constructor'])]), undefined)[0]?.type).toBe('other');
  });

  it('flags embeddable player urls as embeds and everything else, watch pages included, as files', () => {
    const capability = createCapability();
    const video = asset('v', ['video'], [
      { uri: 'https://www.youtube.com/embed/abc', contentType: 'text/html' },
      { uri: 'https://player.vimeo.com/video/123', contentType: 'text/html' },
      { uri: 'https://www.youtube.com/watch?v=abc', contentType: 'text/html' },
      { uri: 'https://vimeo.com/123', contentType: 'text/html' },
      { uri: 'https://cdn.example.com/v.mp4', contentType: 'video/mp4' },
    ]);

    const files = capability.exposeCollectAssets(projection([video]), undefined)[0]?.files ?? [];

    expect(files[0]).toMatchObject({ delivery: 'embed', embedProvider: 'youtube' });
    expect(files[1]).toMatchObject({ delivery: 'embed', embedProvider: 'vimeo' });
    expect(files.slice(2).map((f) => f.delivery)).toEqual(['file', 'file', 'file']);
    expect(files[4]?.mimeType).toBe('video/mp4');
    expect(files[4]?.embedProvider).toBeUndefined();
  });

  it('resolves the title for the request locale and falls back to the first value', () => {
    const named = asset('x', ['manual'], undefined, { en: 'Manual', da: 'Manual (dansk)' });

    expect(createCapability(undefined, 'da-DK').exposeCollectAssets(projection([named]), undefined)[0]?.title).toBe('Manual (dansk)');
    expect(createCapability(undefined, 'fr-FR').exposeCollectAssets(projection([named]), undefined)[0]?.title).toBe('Manual');
  });

  it('filters by type', () => {
    const capability = createCapability();
    const p = projection([asset('m', ['manual']), asset('v', ['video'])]);

    expect(capability.exposeCollectAssets(p, undefined, ['video']).map((a) => a.identifier.key)).toEqual(['v']);
  });

  it('skips assets with a relative source or no sources and keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const capability = createCapability();
    const p = projection([
      asset('good', ['manual']),
      asset('relative', ['manual'], [{ uri: '/media/x.pdf', contentType: 'application/pdf' }]),
      asset('empty', ['manual'], []),
    ]);

    expect(capability.exposeCollectAssets(p, undefined).map((a) => a.identifier.key)).toEqual(['good']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('returns nothing for a product without assets', () => {
    const capability = createCapability();
    expect(capability.exposeCollectAssets(projection(undefined), undefined)).toEqual([]);
    expect(capability.exposeCollectAssets(projection([]), undefined)).toEqual([]);
  });
});
