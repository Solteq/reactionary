import type { RequestContext } from '@reactionary/core';
import { createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoClient } from '../core/client.js';
import {
  MagentoConfigurationSchema,
  type MagentoConfiguration,
} from '../schema/configuration.schema.js';

const baseConfig = {
  adminApiKey: 'admin-token',
  baseUrl: 'https://shop.example.com',
  mediaSource: 'DEFAULT' as const,
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  authStoreCode: 'default',
};

function parse(overrides: Record<string, unknown>): MagentoConfiguration {
  return MagentoConfigurationSchema.parse({ ...baseConfig, ...overrides });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let context: RequestContext;

beforeEach(() => {
  // A fresh Response per call: a single instance can only be read once.
  fetchMock = vi.fn().mockImplementation(async () => jsonResponse({}));
  vi.stubGlobal('fetch', fetchMock);
  context = createInitialRequestContext();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0]);
}

function lastHeaders(): Record<string, string> {
  return (fetchMock.mock.calls.at(-1)?.[1] as RequestInit).headers as Record<string, string>;
}

describe('MagentoClient store view resolution', () => {
  it('suffixes REST calls with the language of the request locale', async () => {
    context.languageContext.locale = 'da-DK';
    const client = await new MagentoClient(parse({ storeBaseCode: 'b2c' }), context).getClient();

    await client.store.product.getBySKU('SKU-1');

    expect(lastUrl()).toBe('https://shop.example.com/rest/b2c-da/V1/products/SKU-1');
  });

  it('re-resolves per call, so a locale set after construction is honoured', async () => {
    context.languageContext.locale = 'en-US';
    const client = await new MagentoClient(parse({ storeBaseCode: 'b2c' }), context).getClient();

    await client.store.product.getBySKU('SKU-1');
    expect(lastUrl()).toContain('/rest/b2c-en/');

    context.languageContext.locale = 'sv-SE';
    await client.store.product.getBySKU('SKU-1');
    expect(lastUrl()).toContain('/rest/b2c-sv/');
  });

  it('falls back to the bare base code when the locale is unusable', async () => {
    context.languageContext.locale = '';
    const client = await new MagentoClient(parse({ storeBaseCode: 'b2c' }), context).getClient();

    await client.store.product.getBySKU('SKU-1');

    expect(lastUrl()).toBe('https://shop.example.com/rest/b2c/V1/products/SKU-1');
  });

  it('omits the store segment entirely when no base code is configured', async () => {
    context.languageContext.locale = 'da-DK';
    const client = await new MagentoClient(parse({}), context).getClient();

    await client.store.product.getBySKU('SKU-1');

    expect(lastUrl()).toBe('https://shop.example.com/rest/V1/products/SKU-1');
  });

  it('keeps the auth scope free of the locale suffix', async () => {
    context.languageContext.locale = 'pl-PL';
    const client = await new MagentoClient(parse({ storeBaseCode: 'b2c' }), context).getClient();

    await client.store.customer.me();

    expect(lastUrl()).toBe('https://shop.example.com/rest/default/V1/customers/me');
  });

  it('sends the resolved store view in the GraphQL Store header', async () => {
    context.languageContext.locale = 'sv-SE';
    fetchMock.mockImplementation(async () =>
      jsonResponse({ data: { products: { items: [] } } }),
    );
    const client = await new MagentoClient(parse({ storeBaseCode: 'b2c' }), context).getClient();

    await client.store.productReviews.list('SKU-1', 1, 10);

    expect(lastHeaders()['Store']).toBe('b2c-sv');
  });

  it('accepts the deprecated storeCode alias', async () => {
    context.languageContext.locale = 'da-DK';
    const config = parse({ storeCode: 'legacy' });
    expect(config.storeBaseCode).toBe('legacy');

    const client = await new MagentoClient(config, context).getClient();
    await client.store.product.getBySKU('SKU-1');

    expect(lastUrl()).toBe('https://shop.example.com/rest/legacy-da/V1/products/SKU-1');
  });

  it('prefers storeBaseCode when both are supplied', () => {
    expect(parse({ storeBaseCode: 'b2c', storeCode: 'legacy' }).storeBaseCode).toBe('b2c');
  });
});
