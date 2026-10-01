import {
  createInitialRequestContext,
  success,
  type Inventory,
  type Price,
  type Product,
  type ProductSearchResult,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { ReactionaryFeedGenerator } from './feed-generator.js';
import { ReactionaryFeedServer } from './feed-server.js';
import { acpProductFeedTransformer } from './transformers/acp-product-feed.transformer.js';
import { googleMerchantFeedTransformer } from './transformers/google-merchant-feed.transformer.js';
import { pricerunnerFeedTransformer } from './transformers/pricerunner-feed.transformer.js';
import { sitemapFeedTransformer } from './transformers/sitemap-feed.transformer.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedDefinition,
  ReactionaryFeedProduct,
} from './feed-types.js';

describe('ReactionaryFeedGenerator', () => {
  it('normalizes Reactionary products and pricing for feed transformers', async () => {
    const observedSearches: unknown[] = [];
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient({
      observedSearches,
    }));

    const products = await collect(generator.products(testFeed, requestContext));

    expect(products).toMatchObject([
      {
        id: 'product-1',
        title: 'Test product',
        url: 'https://shop.example/fi/products/test-product',
        brand: 'Reactionary',
        variants: [
          {
            id: 'sku-1',
            title: 'Test variant',
            price: {
              value: 8,
              currency: 'EUR',
            },
            listPrice: {
              value: 10,
              currency: 'EUR',
            },
            availability: {
              available: true,
              status: 'in_stock',
            },
          },
        ],
      },
    ]);
    expect(requestContext.languageContext).toEqual(testFeed.languageContext);
    expect(observedSearches[0]).toMatchObject({
      term: 'shoes',
      filters: ['market:fi'],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 25,
      },
    });
  });

  it('throws when required client operations are missing', () => {
    expect(() => new ReactionaryFeedGenerator({})).toThrow(
      'Reactionary feed generator cannot initialize because the client is missing required operations',
    );
  });
});

describe('feed transformers', () => {
  it('writes ACP JSONL feed products', async () => {
    const output = await render(acpProductFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: { format: 'jsonl' },
      },
    ));

    expect(output.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(output)).toMatchObject({
      id: 'product-1',
      variants: [
        {
          id: 'sku-1',
          price: {
            amount: 800,
            currency: 'EUR',
          },
          list_price: {
            amount: 1000,
            currency: 'EUR',
          },
        },
      ],
    });
  });

  it('writes sitemap XML', async () => {
    const output = await render(sitemapFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: undefined,
      },
    ));

    expect(output).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(output).toContain('<loc>https://shop.example/fi/products/test-product</loc>');
  });

  it('writes Google Merchant XML', async () => {
    const output = await render(googleMerchantFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: undefined,
      },
    ));

    expect(output).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(output).toContain('<g:id>sku-1</g:id>');
    expect(output).toContain('<g:price>8.00 EUR</g:price>');
  });

  it('writes PriceRunner XML', async () => {
    const output = await render(pricerunnerFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: undefined,
      },
    ));

    expect(output).toContain('<Products>');
    expect(output).toContain('<ProductId>sku-1</ProductId>');
    expect(output).toContain('<Price>8.00 EUR</Price>');
  });
});

describe('ReactionaryFeedServer', () => {
  it('lists feeds and transformers', async () => {
    const server = new ReactionaryFeedServer(() => createTestClient(), {
      feeds: {
        finnish: testFeed,
      },
    });

    const feeds = await server.fetch(new Request('http://127.0.0.1/feeds'));
    const transformers = await server.fetch(
      new Request('http://127.0.0.1/feeds/transformers'),
    );

    await expect(feeds.json()).resolves.toEqual({ feeds: ['finnish'] });
    await expect(transformers.json()).resolves.toMatchObject({
      transformers: expect.arrayContaining([
        expect.objectContaining({ id: 'acp-product-feed' }),
        expect.objectContaining({ id: 'sitemap-feed' }),
      ]),
    });
  });

  it('streams feed transformer output', async () => {
    const observedLanguageContexts: Array<unknown> = [];
    const server = new ReactionaryFeedServer((requestContext) => {
      observedLanguageContexts.push({ ...requestContext.languageContext });
      return createTestClient();
    }, {
      feeds: {
        finnish: testFeed,
      },
    });

    const response = await server.fetch(
      new Request('http://127.0.0.1/feeds/finnish/outputs/acp-product-feed'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(await response.text()).toContain('"id":"product-1"');
    expect(observedLanguageContexts[0]).toEqual(testFeed.languageContext);
  });
});

const testFeed: ReactionaryFeedDefinition = {
  languageContext: {
    locale: 'fi-FI',
    currencyCode: 'EUR',
  },
  search: {
    term: 'shoes',
    facets: [],
    filters: ['market:fi'],
    paginationOptions: {
      pageNumber: 1,
      pageSize: 25,
    },
  },
  productUrlBase: 'https://shop.example/{lang}/products/{slug}',
};

const testFeedProduct: ReactionaryFeedProduct = {
  id: 'product-1',
  title: 'Test product',
  description: 'Test description',
  url: 'https://shop.example/fi/products/test-product',
  brand: 'Reactionary',
  manufacturer: 'Solteq',
  images: [
    {
      url: 'https://cdn.example/product.jpg',
      altText: 'Test product',
    },
  ],
  variants: [
    {
      id: 'sku-1',
      title: 'Test variant',
      url: 'https://shop.example/fi/products/test-product',
      images: [],
      price: {
        value: 8,
        currency: 'EUR',
      },
      listPrice: {
        value: 10,
        currency: 'EUR',
      },
      availability: {
        available: true,
        status: 'in_stock',
      },
      barcodes: [
        {
          type: 'ean',
          value: '1234567890123',
        },
      ],
      options: [
        {
          name: 'Size',
          value: '42',
        },
      ],
    },
  ],
};

function createTestClient(options: {
  observedSearches?: unknown[];
} = {}): ReactionaryFeedClient {
  return {
    productSearch: {
      async queryByTerm(payload) {
        const search = (payload as { search: unknown }).search;
        options.observedSearches?.push(search);

        return success<ProductSearchResult>({
          pageNumber: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          identifier: testFeed.search,
          facets: [],
          items: [
            {
              identifier: {
                key: 'product-1',
              },
              name: 'Search product',
              slug: 'search-product',
              variants: [
                {
                  variant: {
                    sku: 'sku-1',
                  },
                  image: {
                    sourceUrl: 'https://cdn.example/search.jpg',
                    altText: 'Search product',
                  },
                },
              ],
            },
          ],
        });
      },
    },
    product: {
      async getBySKU() {
        return success(createProduct());
      },
    },
    price: {
      async getCustomerPrice() {
        return success(createPrice(8));
      },
      async getListPrice() {
        return success(createPrice(10));
      },
    },
    inventory: {
      async getBySKU() {
        return success<Inventory>({
          identifier: {
            variant: {
              sku: 'sku-1',
            },
            fulfillmentCenter: {
              key: '',
            },
          },
          quantity: 4,
          status: 'inStock',
        });
      },
    },
  };
}

function createProduct(): Product {
  return {
    identifier: {
      key: 'product-1',
    },
    name: 'Test product',
    slug: 'test-product',
    description: 'Test description',
    longDescription: 'Long description',
    brand: 'Reactionary',
    manufacturer: 'Solteq',
    parentCategories: [],
    published: true,
    sharedAttributes: [],
    options: [],
    mainVariant: createVariant(),
    variants: [createVariant()],
  };
}

function createVariant(): Product['mainVariant'] {
  return {
    identifier: {
      sku: 'sku-1',
    },
    name: 'Test variant',
    images: [
      {
        sourceUrl: 'https://cdn.example/product.jpg',
        altText: 'Test product',
      },
    ],
    ean: '1234567890123',
    gtin: '',
    upc: '',
    barcode: '',
    options: [
      {
        identifier: {
          key: 'size',
        },
        name: 'Size',
        value: {
          identifier: {
            option: {
              key: 'size',
            },
            key: '42',
          },
          label: '42',
        },
      },
    ],
  };
}

function createPrice(value: number): Price {
  return {
    identifier: {
      variant: {
        sku: 'sku-1',
      },
    },
    unitPrice: {
      value,
      currency: 'EUR',
    },
    onSale: value < 10,
    tieredPrices: [],
  };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];

  for await (const item of iterable) {
    items.push(item);
  }

  return items;
}

async function render(iterable: AsyncIterable<string | Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  const decoder = new TextDecoder();

  for await (const chunk of iterable) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  }

  return chunks.map((chunk) => decoder.decode(chunk)).join('');
}

async function *asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  yield* items;
}
