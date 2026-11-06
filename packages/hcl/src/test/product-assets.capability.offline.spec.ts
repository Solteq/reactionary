import {
  NoOpCache,
  ProductAssetSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { assert, describe, expect, it, vi } from 'vitest';
import { HclProductAssetsCapability } from '../capabilities/product-assets.capability.js';
import { HclClient } from '../core/client.js';
import { HclProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';
import type {
  HclAttachment,
  HclProductQueryResponse,
  HclProductResponse,
} from '../schema/hcl.schema.js';

function attachment(id: string, usage: string | undefined, path: string, name = id): HclAttachment {
  return { usage, mimeType: 'application/pdf', attachmentAssetPath: path, name, attachmentAssetID: id };
}

function product(
  partNumber: string,
  attachments: HclAttachment[] | undefined,
  items: HclProductResponse[] = [],
): HclProductResponse {
  return {
    id: `id-${partNumber}`,
    partNumber,
    name: partNumber,
    shortDescription: '',
    thumbnail: '',
    type: 'product',
    hasSingleSKU: items.length <= 1,
    buyable: 'true',
    sellerId: '1',
    manufacturer: 'Acme',
    parentCatalogGroupID: '10',
    price: [],
    attributes: [],
    items,
    attachments,
  };
}

const ABSOLUTE = 'https://assets.example.com/manual.pdf';

// Offline (mocked) tests that go through the @Reactionary decorator, so the output is validated against
// ProductAssetSchema as well.
describe('HCL Product Assets Capability (offline)', () => {
  function buildProvider(response: HclProductQueryResponse, configOverrides: Record<string, unknown> = {}) {
    const reqCtx = createInitialRequestContext();
    const config = HclConfigurationSchema.parse({
      apiUrl: 'https://hcl.example.com',
      searchApiUrl: 'https://hcl.example.com/search/resources',
      storeId: '41',
      ...configOverrides,
    });
    const client = new HclClient(config, reqCtx);
    const callGet = vi.spyOn(client, 'callGet').mockResolvedValue(response);
    const provider = new HclProductAssetsCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclProductAssetsFactory(ProductAssetSchema),
    );
    return { provider, callGet };
  }

  async function keysOf(provider: HclProductAssetsCapability, query: Parameters<HclProductAssetsCapability['getAssets']>[0]) {
    const result = await provider.getAssets(query);
    assert(result.success);
    return result.value.map((a) => a.identifier.key);
  }

  it('maps attachments with a known usage and ignores the others', async () => {
    const { provider } = buildProvider({
      contents: [
        product('p1', [
          attachment('a1', 'MANUAL', ABSOLUTE, 'Manual'),
          attachment('a2', 'IMAGE', 'https://assets.example.com/pic.png'),
          attachment('a3', undefined, 'https://assets.example.com/none.pdf'),
          attachment('a4', 'MODEL_3D', 'https://assets.example.com/chair.glb'),
        ]),
      ],
    });

    const result = await provider.getAssets({ forProduct: { key: 'p1' } });

    assert(result.success);
    expect(result.value.map((a) => [a.identifier.key, a.type, a.vendorType])).toEqual([
      ['a1', 'manual', 'MANUAL'],
      ['a4', '3d-model', 'MODEL_3D'],
    ]);
    expect(result.value[0]?.title).toBe('Manual');
    expect(result.value[0]?.files).toEqual([{ url: ABSOLUTE, mimeType: 'application/pdf', delivery: 'file' }]);
  });

  it('makes relative paths absolute against the asset base url, falling back to apiUrl', async () => {
    const relative = [attachment('a1', 'MANUAL', '/wcsstore/Store/docs/manual.pdf')];

    const withBase = buildProvider(
      { contents: [product('p1', relative)] },
      { productAssets: { assetBaseUrl: 'https://cdn.example.com' } },
    );
    const withoutBase = buildProvider({ contents: [product('p1', relative)] });

    const first = await withBase.provider.getAssets({ forProduct: { key: 'p1' } });
    const second = await withoutBase.provider.getAssets({ forProduct: { key: 'p1' } });

    assert(first.success && second.success);
    expect(first.value[0]?.files[0]?.url).toBe('https://cdn.example.com/wcsstore/Store/docs/manual.pdf');
    expect(second.value[0]?.files[0]?.url).toBe('https://hcl.example.com/wcsstore/Store/docs/manual.pdf');
  });

  it('uses the configured usage map', async () => {
    const { provider } = buildProvider(
      { contents: [product('p1', [attachment('a1', 'MY_DOCS', ABSOLUTE)])] },
      { productAssets: { usageTypeMap: { MY_DOCS: 'datasheet' } } },
    );

    const result = await provider.getAssets({ forProduct: { key: 'p1' } });

    assert(result.success);
    expect(result.value[0]?.type).toBe('datasheet');
    expect(result.value[0]?.vendorType).toBe('MY_DOCS');
  });

  it('adds the requested SKU attachments, SKU version first on a key clash', async () => {
    const sku = product('sku-1', [
      attachment('label', 'ENERGY_LABEL', 'https://assets.example.com/label.pdf'),
      attachment('manual', 'MANUAL', ABSOLUTE, 'SKU copy'),
    ]);
    const { provider } = buildProvider({
      contents: [
        product(
          'p1',
          [attachment('manual', 'MANUAL', ABSOLUTE, 'product copy'), attachment('cert', 'CERTIFICATE', 'https://assets.example.com/c.pdf')],
          [sku, product('sku-2', [attachment('other', 'MANUAL', ABSOLUTE)])],
        ),
      ],
    });

    expect(await keysOf(provider, { forProduct: { key: 'p1' }, forVariant: { sku: 'sku-1' } })).toEqual(['label', 'manual', 'cert']);
    expect(await keysOf(provider, { forProduct: { key: 'p1' } })).toEqual(['manual', 'cert']);
    expect(await keysOf(provider, { forProduct: { key: 'p1' }, forVariant: { sku: 'nope' } })).toEqual(['manual', 'cert']);
  });

  it('filters by type', async () => {
    const { provider } = buildProvider({
      contents: [
        product('p1', [
          attachment('m', 'MANUAL', ABSOLUTE),
          attachment('v', 'VIDEO', 'https://assets.example.com/v.mp4'),
        ]),
      ],
    });

    expect(await keysOf(provider, { forProduct: { key: 'p1' }, types: ['video'] })).toEqual(['v']);
  });

  it('skips an attachment without a usable path and keeps the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { provider } = buildProvider({
      contents: [product('p1', [attachment('bad', 'MANUAL', ''), attachment('good', 'MANUAL', ABSOLUTE)])],
    });

    expect(await keysOf(provider, { forProduct: { key: 'p1' } })).toEqual(['good']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns nothing for an unknown product or one without attachments', async () => {
    expect(await keysOf(buildProvider({ contents: [] }).provider, { forProduct: { key: 'x' } })).toEqual([]);
    expect(await keysOf(buildProvider({ contents: [product('p1', undefined)] }).provider, { forProduct: { key: 'p1' } })).toEqual([]);
  });

  it('asks for the product by part number with the product profile', async () => {
    const { provider, callGet } = buildProvider({ contents: [] });

    await provider.getAssets({ forProduct: { key: 'p1' } });

    const params = callGet.mock.calls[0]?.[1];
    expect(params?.get('partNumber')).toBe('p1');
    expect(params?.get('storeId')).toBe('41');
  });
});
