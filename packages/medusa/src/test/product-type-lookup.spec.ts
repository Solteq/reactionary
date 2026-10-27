import { assert, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache, ProductSchema, createInitialRequestContext } from '@reactionary/core';
import type { Cache, RequestContext } from '@reactionary/core';
import { MedusaProductCapability } from '../capabilities/product.capability.js';
import { MedusaProductFactory } from '../factories/product/product.factory.js';
import { MedusaAPI } from '../index.js';
import { MedusaConfigurationSchema } from '../schema/configuration.schema.js';

const config = MedusaConfigurationSchema.parse({
  publishable_key: 'pk_test',
  adminApiKey: 'admin',
  apiUrl: 'http://medusa.test',
  defaultCurrency: 'eur',
});

const definitions = [
  { key: 'icecat-feature-1', names: { en: 'Weight', da: 'Vaegt' }, groups: { en: 'General' }, unit: { en: 'kg' }, order: 1, data_type: 'numeric' },
];

function product(key: string, typeId: string | null) {
  return {
    id: `prod_${key}`,
    external_id: key,
    title: `Product ${key}`,
    handle: key,
    status: 'published',
    type: typeId ? { id: typeId } : null,
    type_id: typeId,
    metadata: { 'icecat-feature-1': '1.5' },
    variants: [{ id: `var_${key}`, title: key, sku: `sku-${key}` }],
    images: [],
    options: [],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Medusa product capability product type lookup', () => {
  let typeRequests: Array<{ url: URL; locale: string | null }>;
  let productRequests: URL[];
  let typeStatus: number;
  const products: Record<string, ReturnType<typeof product>> = {
    a: product('a', 'ptyp_1'),
    b: product('b', 'ptyp_1'),
    c: product('c', 'ptyp_2'),
    none: product('none', null),
    d: product('d', 'ptyp_nonames'),
  };

  beforeEach(() => {
    typeRequests = [];
    productRequests = [];
    typeStatus = 200;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : undefined;
        const url = new URL(request ? request.url : input.toString());
        const headers = new Headers(init?.headers ?? request?.headers);
        if (url.pathname.startsWith('/store/product-types/')) {
          const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
          typeRequests.push({ url, locale: headers.get('x-medusa-locale') });
          if (typeStatus !== 200) {
            return jsonResponse({ message: 'down' }, typeStatus);
          }
          const locale = headers.get('x-medusa-locale') ?? '';
          // the value is translated for the language of the request, the names are in the metadata
          const names = id === 'ptyp_nonames' ? {} : { names: { en: 'Drills', da: 'Boremaskiner' } };
          return jsonResponse({
            product_type: {
              id,
              value: locale.startsWith('da') ? 'Boremaskiner' : 'Drills',
              external_id: `icecat-cat-${id}`,
              metadata: { attribute_definitions: definitions, ...names },
              created_at: '',
              updated_at: '',
            },
          });
        }
        productRequests.push(url);
        const external = url.searchParams.get('external_id');
        const handle = url.searchParams.get('handle');
        const key = external ?? handle ?? 'a';
        const found = products[key];
        return jsonResponse({ products: found ? [found] : [], count: found ? 1 : 0, offset: 0, limit: 1 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function capability(cache: Cache = new MemoryCache(), locale = 'en-US') {
    const context: RequestContext = createInitialRequestContext();
    context.languageContext.locale = locale;
    return new MedusaProductCapability(config, cache, context, new MedusaAPI(config, context), new MedusaProductFactory(ProductSchema));
  }

  it('asks for the id of the type only, not the whole type', async () => {
    await capability().getById({ identifier: { key: 'a' } });

    const fields = productRequests[0].searchParams.get('fields') ?? '';
    expect(fields.split(',')).toContain('+type.id');
    expect(fields).not.toContain('+type.*');
    expect(fields.split(',')).toContain('+tags.*');
  });

  it('looks the type up with its metadata and the locale and labels the attributes from it', async () => {
    const result = await capability(new MemoryCache(), 'da-DK').getById({ identifier: { key: 'a' } });

    if (!result.success) {
      assert.fail();
    }
    expect(typeRequests).toHaveLength(1);
    expect(typeRequests[0].url.pathname).toBe('/store/product-types/ptyp_1');
    expect(typeRequests[0].url.searchParams.get('fields')).toBe('+metadata,+external_id');
    expect(typeRequests[0].locale).toBe('da-DK');
    expect(result.value.productType).toEqual({ identifier: { key: 'icecat-cat-ptyp_1' }, name: 'Boremaskiner' });
    expect(result.value.sharedAttributes[0]).toMatchObject({ name: 'Vaegt', group: 'General', unit: 'kg' });
  });

  it('does not ask for a type again for a second product of the same type', async () => {
    const cache = new MemoryCache();

    await capability(cache).getById({ identifier: { key: 'a' } });
    const second = await capability(cache).getById({ identifier: { key: 'b' } });
    const slug = await capability(cache).getBySlug({ slug: 'a' });

    expect(second.success && slug.success).toBe(true);
    expect(typeRequests).toHaveLength(1);
  });

  it('looks up each distinct type once, and none for a product without a type', async () => {
    const cache = new MemoryCache();

    await capability(cache).getById({ identifier: { key: 'c' } });
    await capability(cache).getById({ identifier: { key: 'none' } });

    expect(typeRequests.map((r) => r.url.pathname)).toEqual(['/store/product-types/ptyp_2']);
  });

  it('keeps one cache entry per type for all locales and still names the type per locale', async () => {
    const cache = new MemoryCache();

    const english = await capability(cache, 'en-US').getById({ identifier: { key: 'a' } });
    const danish = await capability(cache, 'da-DK').getById({ identifier: { key: 'a' } });
    const danishAgain = await capability(cache, 'da-DK').getById({ identifier: { key: 'b' } });

    if (!english.success || !danish.success || !danishAgain.success) {
      assert.fail();
    }
    // one request for the type, not one per locale
    expect(typeRequests).toHaveLength(1);
    expect(english.value.productType?.name).toBe('Drills');
    expect(danish.value.productType?.name).toBe('Boremaskiner');
    expect(danishAgain.value.productType?.name).toBe('Boremaskiner');
    // and the labels of the attributes resolve per locale from the shared definitions
    expect(english.value.sharedAttributes[0].name).toBe('Weight');
    expect(danish.value.sharedAttributes[0].name).toBe('Vaegt');
  });

  it('does not serve the translated value of one locale to another, a type without names falls back to its key', async () => {
    const cache = new MemoryCache();

    const danish = await capability(cache, 'da-DK').getById({ identifier: { key: 'd' } });
    const english = await capability(cache, 'en-US').getById({ identifier: { key: 'd' } });

    if (!danish.success || !english.success) {
      assert.fail();
    }
    expect(typeRequests).toHaveLength(1);
    expect(danish.value.productType?.name).toBe('icecat-cat-ptyp_nonames');
    expect(english.value.productType?.name).toBe('icecat-cat-ptyp_nonames');
  });

  it('degrades when the type cannot be fetched, logs it, and tries again the next time', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = new MemoryCache();
    typeStatus = 500;

    const failed = await capability(cache).getById({ identifier: { key: 'a' } });

    if (!failed.success) {
      assert.fail();
    }
    // the product still maps, with the machine key of the attribute
    expect(failed.value.sharedAttributes[0]).toMatchObject({ identifier: { key: 'icecat-feature-1' }, name: 'icecat-feature-1' });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('ptyp_1'), expect.anything());

    typeStatus = 200;
    // another product of the type, the degraded product itself is cached by the product cache for its own TTL
    const retried = await capability(cache).getById({ identifier: { key: 'b' } });

    if (!retried.success) {
      assert.fail();
    }
    expect(typeRequests).toHaveLength(2);
    expect(retried.value.sharedAttributes[0].name).toBe('Weight');
  });

  it('looks the type up for a product found by sku as well', async () => {
    const result = await capability().getBySKU({ variant: { sku: 'sku-a' } });

    expect(result.success).toBe(true);
    expect(typeRequests).toHaveLength(1);
  });
});
