import {
  createInitialRequestContext,
  success,
  type Category,
  type CategoryPaginatedResult,
  type Inventory,
  type Price,
  type Product,
  type ProductRatingSummary,
  type ProductReviewPaginatedResult,
  type ProductSearchResult,
  type Store,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { ReactionaryFeedGenerator } from './feed-generator.js';
import { ReactionaryFeedServer } from './feed-server.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { acpProductFeedTransformer, toACPFeedMetadata } from './transformers/acp-product-feed.transformer.js';
import { googleMerchantFeedTransformer } from './transformers/google-merchant-feed.transformer.js';
import { pricerunnerFeedTransformer } from './transformers/pricerunner-feed.transformer.js';
import { sitemapFeedTransformer } from './transformers/sitemap-feed.transformer.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedDefinition,
  ReactionaryFeedProduct,
  ReactionaryFeedProgress,
  ReactionarySitemapOptions,
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
        categoryPath: [
          {
            id: 'parent',
            name: 'Parent Category',
            slug: 'parent-category',
          },
        ],
        ratingSummary: {
          averageRating: 4.5,
          totalRatings: 12,
        },
        reviews: [
          {
            id: 'review-1',
            rating: 5,
          },
        ],
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

  it('uses default fulfillment center keys for inventory requests', async () => {
    const observedInventoryQueries: unknown[] = [];
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient({
      observedInventoryQueries,
      inventoryByFulfillmentCenterKey: {
        east: createInventory('east', 0, 'outOfStock'),
        west: createInventory('west', 4, 'inStock'),
      },
    }), {
      defaultFulfillmentCenterKeys: ['east', 'west'],
    });

    const products = await collect(generator.products(testFeed, requestContext));

    expect(observedInventoryQueries).toMatchObject([
      {
        fulfilmentCenter: {
          key: 'east',
        },
      },
      {
        fulfilmentCenter: {
          key: 'west',
        },
      },
    ]);
    expect(products[0]?.variants[0]?.availability).toMatchObject({
      available: true,
      quantity: 4,
      status: 'in_stock',
    });
  });

  it('lets a feed override default fulfillment center keys', async () => {
    const observedInventoryQueries: unknown[] = [];
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient({
      observedInventoryQueries,
    }), {
      defaultFulfillmentCenterKeys: ['default'],
    });

    await collect(generator.products({
      ...testFeed,
      fulfillmentCenterKeys: ['feed-a', 'feed-b'],
    }, requestContext));

    expect(observedInventoryQueries).toMatchObject([
      {
        fulfilmentCenter: {
          key: 'feed-a',
        },
      },
      {
        fulfilmentCenter: {
          key: 'feed-b',
        },
      },
    ]);
  });

  it('keeps the legacy singular fulfillment center key working', async () => {
    const observedInventoryQueries: unknown[] = [];
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient({
      observedInventoryQueries,
    }));

    await collect(generator.products({
      ...testFeed,
      fulfillmentCenterKey: 'legacy',
    }, requestContext));

    expect(observedInventoryQueries).toMatchObject([
      {
        fulfilmentCenter: {
          key: 'legacy',
        },
      },
    ]);
  });

  it('reports feed generation progress', async () => {
    const progress: ReactionaryFeedProgress[] = [];
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient(), {
      onProgress: (event) => progress.push(event),
    });

    await collect(generator.products(testFeed, requestContext));

    expect(progress).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'searching',
        processedProducts: 0,
      }),
      expect.objectContaining({
        phase: 'generating',
        processedProducts: 1,
        totalProducts: 1,
        pageNumber: 1,
        totalPages: 1,
      }),
      expect.objectContaining({
        phase: 'completed',
        processedProducts: 1,
        totalProducts: 1,
      }),
    ]));
  });

  it('normalizes products with bounded concurrency', async () => {
    let activeProductLookups = 0;
    let maxActiveProductLookups = 0;
    const requestContext = createInitialRequestContext();
    const generator = new ReactionaryFeedGenerator(createTestClient({
      searchItemCount: 5,
      async beforeProductLookup() {
        activeProductLookups += 1;
        maxActiveProductLookups = Math.max(
          maxActiveProductLookups,
          activeProductLookups,
        );
        await delay(5);
      },
      afterProductLookup() {
        activeProductLookups -= 1;
      },
    }), {
      productConcurrency: 2,
    });

    const products = await collect(generator.products(testFeed, requestContext));

    expect(products).toHaveLength(5);
    expect(maxActiveProductLookups).toBe(2);
  });
});

describe('feed transformers', () => {
  it('writes ACP Feed API products as JSONL', async () => {
    const output = await render(acpProductFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: { format: 'jsonl' },
      },
    ));

    expect(output.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(output)).toEqual({
      id: 'product-1',
      title: 'Test product',
      description: { plain: 'Test description' },
      url: 'https://shop.example/fi/products/test-product',
      media: [{ type: 'image', url: 'https://cdn.example/product.jpg', alt_text: 'Test product' }],
      variants: [
        {
          id: 'sku-1',
          title: 'Test variant',
          url: 'https://shop.example/fi/products/test-product',
          barcodes: [
            { type: 'ean', value: '1234567890123' },
            { type: 'gtin', value: '00012345678905' },
            { type: 'upc', value: '042100005264' },
            { type: 'barcode', value: '1234567890123' },
          ],
          price: { amount: 800, currency: 'EUR' },
          list_price: { amount: 1000, currency: 'EUR' },
          availability: { available: true, status: 'in_stock' },
          categories: [{ value: 'Parent Category > Child Category' }],
          variant_options: [{ name: 'Size', value: '42' }],
          seller: { name: 'Reactionary Shop' },
        },
      ],
    });
  });

  it('writes ACP feed products and metadata valid against the official schema', async () => {
    const schema: unknown = JSON.parse(readFileSync(
      new URL('./__fixtures__/acp-spec-2026-04-17/schema.feed.json', import.meta.url),
      'utf8',
    ));

    if (typeof schema !== 'object' || schema === null) {
      throw new Error('Expected the feed schema to be a JSON object');
    }

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
    ajv.addSchema(schema);
    const schemaId = String(Reflect.get(schema, '$id'));
    const validateProduct = ajv.getSchema(`${schemaId}#/$defs/Product`);
    const validateMetadata = ajv.getSchema(`${schemaId}#/$defs/FeedMetadata`);
    const output = await render(acpProductFeedTransformer.transform(
      asAsyncIterable([testFeedProduct]),
      { feedId: 'finnish', feed: testFeed, options: { format: 'jsonl' } },
    ));
    const product: unknown = JSON.parse(output);
    const metadata = toACPFeedMetadata('finnish', testFeed);

    expect(validateProduct?.(product), ajv.errorsText(validateProduct?.errors)).toBe(true);
    expect(validateMetadata?.(metadata), ajv.errorsText(validateMetadata?.errors)).toBe(true);
    // Negative control: the previous flat row format is rejected.
    expect(validateProduct?.({ item_id: 'sku-1', price: '8.00 EUR' })).toBe(false);
  });

  it('writes the ACP Feed API upsert body and feed metadata', async () => {
    const output = await render(acpProductFeedTransformer.transform(
      asAsyncIterable([testFeedProduct, { ...testFeedProduct, id: 'no-variants', variants: [] }]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: { format: 'json' },
      },
    ));
    const body = JSON.parse(output) as { products: Array<{ id: string }> };

    expect(Object.keys(body)).toEqual(['products']);
    expect(body.products.map((product) => product.id)).toEqual(['product-1']);
    expect(toACPFeedMetadata('finnish', testFeed, new Date('2026-10-05T12:00:00Z'))).toEqual({
      id: 'finnish',
      target_country: 'FI',
      updated_at: '2026-10-05T12:00:00.000Z',
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

    expect(output).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
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

  it('escapes Google Merchant XML text through the builder', async () => {
    const output = await render(googleMerchantFeedTransformer.transform(
      asAsyncIterable([
        {
          ...testFeedProduct,
          title: 'R&D <Test>',
          variants: [
            {
              ...testFeedProduct.variants[0],
              title: 'Size 42 & "wide"',
            },
          ],
        },
      ]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: undefined,
      },
    ));

    expect(output).toContain('<title>Size 42 &amp; "wide"</title>');
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

  it('writes PriceRunner descriptive text as CDATA through the builder', async () => {
    const output = await render(pricerunnerFeedTransformer.transform(
      asAsyncIterable([
        {
          ...testFeedProduct,
          variants: [
            {
              ...testFeedProduct.variants[0],
              title: 'R&D <Test>',
            },
          ],
        },
      ]),
      {
        feedId: 'finnish',
        feed: testFeed,
        options: undefined,
      },
    ));

    expect(output).toContain('<ProductName><![CDATA[R&D <Test>]]></ProductName>');
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
    expect(await response.text()).toContain('"variants":[{"id":"sku-1"');
    expect(observedLanguageContexts[0]).toEqual(testFeed.languageContext);
  });

  it('serves a sitemap index for included source ids', async () => {
    const server = new ReactionaryFeedServer(() => createTestClient(), {
      feeds: {
        finnish: testFeed,
      },
      sitemaps: {
        ...testSitemaps,
        include: ['categories-fi', 'stores-fi'],
      },
    });

    const response = await server.fetch(
      new Request('http://127.0.0.1/sitemaps.xml'),
    );
    const output = await response.text();

    expect(response.status).toBe(200);
    expect(output).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(output).toContain('<loc>https://shop.example/sitemaps/categories-fi.xml</loc>');
    expect(output).toContain('<loc>https://shop.example/sitemaps/stores-fi.xml</loc>');
    expect(output).not.toContain('products-fi.xml');
  });

  it('serves product, category, and store sitemap sources', async () => {
    const observedStoreQueries: unknown[] = [];
    const server = new ReactionaryFeedServer(() => createTestClient({
      observedStoreQueries,
    }), {
      feeds: {
        finnish: testFeed,
      },
      sitemaps: testSitemaps,
    });

    const product = await server.fetch(
      new Request('http://127.0.0.1/sitemaps/products-fi.xml'),
    );
    const categories = await server.fetch(
      new Request('http://127.0.0.1/sitemaps/categories-fi.xml'),
    );
    const stores = await server.fetch(
      new Request('http://127.0.0.1/sitemaps/stores-fi.xml'),
    );

    await expect(product.text()).resolves.toContain(
      '<loc>https://shop.example/fi/products/test-product</loc>',
    );
    await expect(categories.text()).resolves.toContain(
      '<loc>https://shop.example/fi/categories/parent-category</loc>',
    );
    await expect(stores.text()).resolves.toContain(
      '<loc>https://shop.example/fi/stores/helsinki-store</loc>',
    );
    expect(observedStoreQueries[0]).toEqual({
      longitude: 12,
      latitude: 55,
      distance: 100,
      limit: 10,
    });
  });

  it('does not serve sitemap sources excluded by configuration', async () => {
    const server = new ReactionaryFeedServer(() => createTestClient(), {
      feeds: {
        finnish: testFeed,
      },
      sitemaps: {
        ...testSitemaps,
        include: ['products-fi'],
      },
    });

    const response = await server.fetch(
      new Request('http://127.0.0.1/sitemaps/categories-fi.xml'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Sitemap source not found: categories-fi',
    });
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
  sellerName: 'Reactionary Shop',
};

const testFeedProduct: ReactionaryFeedProduct = {
  id: 'product-1',
  title: 'Test product',
  description: 'Test description',
  url: 'https://shop.example/fi/products/test-product',
  brand: 'Reactionary',
  manufacturer: 'Solteq',
  categoryPath: [
    {
      id: 'parent',
      name: 'Parent Category',
      slug: 'parent-category',
    },
    {
      id: 'child',
      name: 'Child Category',
      slug: 'child-category',
    },
  ],
  ratingSummary: {
    averageRating: 4.5,
    totalRatings: 12,
    ratingDistribution: {
      '1': 0,
      '2': 1,
      '3': 1,
      '4': 3,
      '5': 7,
    },
  },
  reviews: [
    {
      id: 'review-1',
      authorName: 'Ada Lovelace',
      rating: 5,
      title: 'Great product',
      content: 'Works exactly as expected.',
      createdAt: '2025-01-01T00:00:00.000Z',
      verified: true,
    },
  ],
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
      ean: '1234567890123',
      gtin: '00012345678905',
      upc: '042100005264',
      barcode: '1234567890123',
      manufacturerPartNumber: 'sku-1',
      barcodes: [
        {
          type: 'ean',
          value: '1234567890123',
        },
        {
          type: 'gtin',
          value: '00012345678905',
        },
        {
          type: 'upc',
          value: '042100005264',
        },
        {
          type: 'barcode',
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

const testSitemaps: ReactionarySitemapOptions = {
  baseUrl: 'https://shop.example',
  sources: {
    'products-fi': {
      type: 'products',
      feed: 'finnish',
      changefreq: 'daily',
      priority: 0.8,
    },
    'categories-fi': {
      type: 'categories',
      languageContext: testFeed.languageContext,
      urlTemplate: 'https://shop.example/{lang}/categories/{slug}',
      pageSize: 10,
      maxDepth: 2,
      changefreq: 'weekly',
    },
    'stores-fi': {
      type: 'stores',
      languageContext: testFeed.languageContext,
      urlTemplate: 'https://shop.example/{lang}/stores/{slug}',
      proximity: {
        longitude: 12,
        latitude: 55,
        distance: 100,
        limit: 10,
      },
      changefreq: 'monthly',
    },
  },
};

function createTestClient(options: {
  observedSearches?: unknown[];
  observedStoreQueries?: unknown[];
  observedInventoryQueries?: unknown[];
  inventoryByFulfillmentCenterKey?: Record<string, Inventory | undefined>;
  searchItemCount?: number;
  beforeProductLookup?: () => Promise<void>;
  afterProductLookup?: () => void;
} = {}): ReactionaryFeedClient {
  return {
    productSearch: {
      async queryByTerm(payload) {
        const search = (payload as { search: unknown }).search;
        options.observedSearches?.push(search);
        const itemCount = options.searchItemCount ?? 1;

        return success<ProductSearchResult>({
          pageNumber: 1,
          pageSize: 25,
          totalCount: itemCount,
          totalPages: 1,
          identifier: testFeed.search,
          facets: [],
          items: Array.from({ length: itemCount }, (_, index) =>
            createSearchItem(index + 1),
          ),
        });
      },
    },
    product: {
      async getBySKU(payload) {
        await options.beforeProductLookup?.();

        try {
          const sku = (payload as { variant: { sku: string } }).variant.sku;
          return success(createProduct(sku));
        } finally {
          options.afterProductLookup?.();
        }
      },
    },
    productReviews: {
      async getRatingSummary() {
        return success<ProductRatingSummary>({
          identifier: {
            product: {
              key: 'product-1',
            },
          },
          averageRating: 4.5,
          totalRatings: 12,
          ratingDistribution: {
            '1': 0,
            '2': 1,
            '3': 1,
            '4': 3,
            '5': 7,
          },
        });
      },
      async findReviews() {
        return success<ProductReviewPaginatedResult>({
          pageNumber: 1,
          pageSize: 3,
          totalCount: 1,
          totalPages: 1,
          items: [
            {
              identifier: {
                key: 'review-1',
              },
              product: {
                key: 'product-1',
              },
              authorName: 'Ada Lovelace',
              rating: 5,
              title: 'Great product',
              content: 'Works exactly as expected.',
              createdAt: '2025-01-01T00:00:00.000Z',
              verified: true,
            },
          ],
        });
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
      async getBySKU(payload) {
        options.observedInventoryQueries?.push(payload);
        const fulfillmentCenterKey = (payload as {
          fulfilmentCenter: { key: string };
        }).fulfilmentCenter.key;

        return success<Inventory>(
          options.inventoryByFulfillmentCenterKey?.[fulfillmentCenterKey]
            ?? createInventory(fulfillmentCenterKey, 4, 'inStock'),
        );
      },
    },
    category: {
      async getBreadcrumbPathToCategory() {
        return success<Category[]>([
          createCategory('parent', 'Parent Category', 'parent-category'),
        ]);
      },
      async findTopCategories() {
        return success<CategoryPaginatedResult>({
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
          items: [
            createCategory('parent', 'Parent Category', 'parent-category'),
          ],
        });
      },
      async findChildCategories(payload) {
        const parentId = (payload as {
          parentId: { key: string };
        }).parentId.key;

        return success<CategoryPaginatedResult>({
          pageNumber: 1,
          pageSize: 10,
          totalCount: parentId === 'parent' ? 1 : 0,
          totalPages: 1,
          items: parentId === 'parent'
            ? [
                createCategory('child', 'Child Category', 'child-category'),
              ]
            : [],
        });
      },
    },
    store: {
      async queryByProximity(payload) {
        options.observedStoreQueries?.push(payload);

        return success<Store[]>([
          {
            identifier: {
              key: 'store-1',
            },
            name: 'Helsinki Store',
            fulfillmentCenter: {
              key: 'helsinki',
            },
          },
        ]);
      },
    },
  };
}

function createSearchItem(index: number): ProductSearchResult['items'][number] {
  return {
    identifier: {
      key: `product-${index}`,
    },
    name: 'Search product',
    slug: 'search-product',
    variants: [
      {
        variant: {
          sku: `sku-${index}`,
        },
        image: {
          sourceUrl: 'https://cdn.example/search.jpg',
          altText: 'Search product',
        },
      },
    ],
  };
}

function createInventory(
  fulfillmentCenterKey: string,
  quantity: number,
  status: Inventory['status'],
): Inventory {
  return {
    identifier: {
      variant: {
        sku: 'sku-1',
      },
      fulfillmentCenter: {
        key: fulfillmentCenterKey,
      },
    },
    quantity,
    status,
  };
}

function createCategory(
  key: string,
  name: string,
  slug: string,
): Category {
  return {
    identifier: {
      key,
    },
    name,
    slug,
    text: '',
    images: [],
  };
}

function createProduct(sku = 'sku-1'): Product {
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
    parentCategories: [
      {
        key: 'parent',
      },
    ],
    published: true,
    sharedAttributes: [],
    options: [],
    mainVariant: createVariant(sku),
    variants: [createVariant(sku)],
  };
}

function createVariant(sku = 'sku-1'): Product['mainVariant'] {
  return {
    identifier: {
      sku,
    },
    name: 'Test variant',
    images: [
      {
        sourceUrl: 'https://cdn.example/product.jpg',
        altText: 'Test product',
      },
    ],
    ean: '1234567890123',
    gtin: '00012345678905',
    upc: '042100005264',
    barcode: '1234567890123',
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
