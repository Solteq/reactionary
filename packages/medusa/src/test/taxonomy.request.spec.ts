import { assert, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialRequestContext,
  NoOpCache,
  ConceptSchema,
  VocabularySchema,
} from '@reactionary/core';
import { MedusaTaxonomyCapability } from '../capabilities/taxonomy.capability.js';
import { MedusaTaxonomyFactory } from '../factories/taxonomy/taxonomy.factory.js';
import { MedusaAPI } from '../index.js';
import { MedusaConfigurationSchema } from '../schema/configuration.schema.js';

const config = MedusaConfigurationSchema.parse({
  publishable_key: 'pk_test',
  adminApiKey: 'admin',
  apiUrl: 'http://medusa.test',
  defaultCurrency: 'eur',
});

function tag(id: string, vocabulary: string) {
  return { id: `ptag_${id}`, value: id, external_id: id, created_at: '', updated_at: '', metadata: { vocabulary } };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

/**
 * Exercises the real request construction of the capability against a stubbed fetch.
 */
function setup(respond: (url: URL) => unknown) {
  const requests: Array<{ url: URL; headers: Headers }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push({ url, headers: new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)) });
      return jsonResponse(respond(url));
    }),
  );

  const context = createInitialRequestContext();
  context.languageContext.locale = 'da-DK';
  const capability = new MedusaTaxonomyCapability(
    config,
    new NoOpCache(),
    context,
    new MedusaAPI(config, context),
    new MedusaTaxonomyFactory(ConceptSchema, VocabularySchema),
  );
  return { capability, requests };
}

describe('Medusa taxonomy capability requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests getConcepts from the product-tags endpoint with the external ids, fields and locale', async () => {
    const { capability, requests } = setup(() => ({
      product_tags: [tag('features/cordless', 'features'), tag('brands/acme', 'brands')],
      count: 2,
      offset: 0,
      limit: 2,
    }));

    const result = await capability.getConcepts({ concepts: [{ key: 'features/cordless' }, { key: 'brands/acme' }] });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.map((t) => t.identifier.key)).toEqual(['features/cordless', 'brands/acme']);
    expect(requests).toHaveLength(1);
    const { url, headers } = requests[0];
    expect(url.pathname).toBe('/store/product-tags');
    expect(url.searchParams.get('fields')).toBe('+external_id,+metadata');
    // the SDK encodes arrays with indices, which the Medusa query parser reads back as an array
    expect(url.searchParams.get('external_id[0]')).toBe('features/cordless');
    expect(url.searchParams.get('external_id[1]')).toBe('brands/acme');
    expect(url.searchParams.get('limit')).toBe('2');
    expect(headers.get('x-medusa-locale')).toBe('da-DK');
    expect(headers.get('x-publishable-api-key')).toBe('pk_test');
  });

  it('pages through the tags of a vocabulary', async () => {
    const all = Array.from({ length: 250 }, (_, i) => tag(`features/t${i}`, 'features'));
    const { capability, requests } = setup((url) => {
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      return { product_tags: all.slice(offset, offset + limit), count: all.length, offset, limit };
    });

    const result = await capability.getVocabulary({ vocabulary: { key: 'features' } });

    if (!result.success) {
      assert.fail();
    }
    expect(requests.map((r) => [r.url.pathname, r.url.searchParams.get('offset'), r.url.searchParams.get('limit')])).toEqual([
      ['/store/product-tags', '0', '100'],
      ['/store/product-tags', '100', '100'],
      ['/store/product-tags', '200', '100'],
    ]);
    expect(result.value.concepts).toHaveLength(250);
    expect(requests.every((r) => r.url.searchParams.get('fields') === '+external_id,+metadata')).toBe(true);
    expect(requests.every((r) => r.headers.get('x-medusa-locale') === 'da-DK')).toBe(true);
  });
});
