import {
  BaseCapability,
  createInitialRequestContext,
  MemoryCache,
  Reactionary,
  success,
  type Cache,
  type Cart,
  type FacetValueIdentifier,
  type ProductSearchResult,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

const TestCartOutputSchema = z.looseObject({
  identifier: z.object({ key: z.string() }),
  items: z.array(z.unknown()),
  price: z.object({
    grandTotal: z.object({
      value: z.number(),
      currency: z.string(),
    }),
  }),
});

class TestProductSearchCapability extends BaseCapability {
  public lastPayload: unknown;
  public lastCategoryPath: unknown;

  @Reactionary({
    inputSchema: z.looseObject({
      term: z.string().optional().meta({ description: 'Configured project search term' }),
      search: z.looseObject({
        term: z.string().meta({ description: 'Configured project search term' }),
      }).optional(),
    }),
    outputSchema: z.object({
      items: z.array(z.object({
        identifier: z.object({ key: z.string() }),
        name: z.string(),
      })),
    }),
    title: 'Configured product search',
    description: 'Searches products using the configured client schema',
  })
  public async queryByTerm(payload: unknown): Promise<Result<ProductSearchResult>> {
    this.lastPayload = payload;
    this.context.session['test.lastSearch'] = payload;
    const pageNumber = getSearchPageNumber(payload);
    const pageSize = getSearchPageSize(payload);

    return success({
      pageNumber,
      pageSize,
      totalCount: 12,
      totalPages: 3,
      facets: [],
      identifier: {
        term: 'test',
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber,
          pageSize,
        },
      },
      items: [
        {
          identifier: { key: 'product-1' },
          name: 'Test product',
          slug: 'test-product',
          variants: [],
        },
      ],
    });
  }

  public async createCategoryNavigationFilter(
    payload: unknown,
  ): Promise<Result<FacetValueIdentifier>> {
    this.lastCategoryPath = payload;
    const parsed = z.looseObject({
      categoryPath: z.array(z.looseObject({
        name: z.string(),
      })),
    }).parse(payload);

    return success({
      facet: { key: 'categories' },
      key: parsed.categoryPath.map((category) => category.name).join(' > '),
    });
  }

  protected getResourceName(): string {
    return 'product-search';
  }
}

function getSearchPageNumber(payload: unknown): number {
  const parsed = z.looseObject({
    search: z.looseObject({
      paginationOptions: z.looseObject({
        pageNumber: z.number(),
      }),
    }),
  }).safeParse(payload);

  return parsed.success ? parsed.data.search.paginationOptions.pageNumber : 1;
}

function getSearchPageSize(payload: unknown): number {
  const parsed = z.looseObject({
    search: z.looseObject({
      paginationOptions: z.looseObject({
        pageSize: z.number(),
      }),
    }),
  }).safeParse(payload);

  return parsed.success ? parsed.data.search.paginationOptions.pageSize : 10;
}

class TestCartCapability extends BaseCapability {
  public constructor(
    cache: Cache,
    context: RequestContext,
    private readonly onAdd?: () => void,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: z.object({
      sku: z.string(),
      quantity: z.int().positive(),
    }),
    outputSchema: z.object({
      identifier: z.object({ key: z.string() }),
    }),
  })
  public async add(): Promise<Result<Cart>> {
    this.onAdd?.();
    return success(createTestCart('cart-created'));
  }

  @Reactionary({
    inputSchema: z.object({
      key: z.string().optional(),
    }),
    outputSchema: TestCartOutputSchema,
  })
  public async createCart(): Promise<Result<Cart>> {
    return success(createTestCart('cart-created'));
  }

  @Reactionary({
    inputSchema: z.object({
      cart: z.object({ key: z.string() }),
    }),
    outputSchema: TestCartOutputSchema,
  })
  public async getById(): Promise<Result<Cart>> {
    return success(createTestCart('cart-created'));
  }

  public async remove(): Promise<Result<Cart>> {
    return success(createTestCart('cart-created'));
  }

  public async changeQuantity(): Promise<Result<Cart>> {
    return success(createTestCart('cart-created'));
  }

  @Reactionary({
    inputSchema: z.object({
      cart: z.object({ key: z.string() }),
    }),
    outputSchema: z.void(),
  })
  public async deleteCart(): Promise<Result<void>> {
    return success(undefined);
  }

  protected getResourceName(): string {
    return 'cart';
  }
}

class TestCartReconciliationCapability extends BaseCapability {
  public readonly calls: unknown[] = [];

  public async getById(): Promise<Result<Cart>> {
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-remove', 'sku-remove', 1),
      createTestCartItem('item-change', 'sku-change', 1),
    ]));
  }

  public async remove(payload: unknown): Promise<Result<Cart>> {
    this.calls.push({ method: 'remove', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 1),
    ]));
  }

  public async changeQuantity(payload: unknown): Promise<Result<Cart>> {
    this.calls.push({ method: 'changeQuantity', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 3),
    ]));
  }

  public async add(payload: unknown): Promise<Result<Cart>> {
    this.calls.push({ method: 'add', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 3),
      createTestCartItem('item-add', 'sku-add', 2),
    ]));
  }

  public async createCart(): Promise<Result<Cart>> {
    return success(createTestCart('cart-reconcile'));
  }

  public async deleteCart(): Promise<Result<void>> {
    return success(undefined);
  }

  protected getResourceName(): string {
    return 'cart';
  }
}

function createTestCart(
  id: string,
  items: Cart['items'] = [],
): Cart {
  return {
    identifier: { key: id },
    user: { userId: 'test-user' },
    name: '',
    items,
    price: createTestCostBreakdown(1234),
    appliedPromotions: [],
    description: '',
  };
}

function createTestCartItem(
  id: string,
  sku: string,
  quantity: number,
): Cart['items'][number] {
  return {
    identifier: { key: id },
    product: { key: 'product-1' },
    variant: { sku },
    quantity,
    price: {
      unitPrice: createTestAmount(100),
      unitDiscount: createTestAmount(0),
      totalPrice: createTestAmount(100 * quantity),
      totalDiscount: createTestAmount(0),
    },
  };
}

function createTestCostBreakdown(total: number): Cart['price'] {
  return {
    totalTax: createTestAmount(0),
    totalDiscount: createTestAmount(0),
    totalSurcharge: createTestAmount(0),
    totalShipping: createTestAmount(0),
    totalProductPrice: createTestAmount(total),
    grandTotal: createTestAmount(total),
  };
}

function createTestAmount(value: number): Cart['price']['grandTotal'] {
  return {
    value,
    currency: 'EUR',
  };
}

describe('ReactionaryUCPServer', () => {
  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('returns not found for unmatched routes', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    const response = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get('ucp-session-id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No UCP route matched GET /ucp.',
      },
    });
  });

  it('persists request context session state by UCP session id', async () => {
    const observedSessions: RequestContext['session'][] = [];
    const server = new ReactionaryUCPServer(
      (requestContext) => {
        observedSessions.push({ ...requestContext.session });
        requestContext.session['test.marker'] = 'saved';
        return {};
      },
      { sessionCache: new MemoryCache() },
    );

    const first = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const sessionId = first.headers.get('ucp-session-id');

    expect(sessionId).toBeTruthy();

    await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        headers: {
          'ucp-session-id': sessionId ?? '',
        },
      }),
    );

    expect(observedSessions[1]?.['test.marker']).toBe('saved');
  });

  it('advertises configured payment handlers in the profile', async () => {
    const server = new ReactionaryUCPServer(
      (requestContext) => ({
        cart: new TestCartCapability(new MemoryCache(), requestContext),
      }),
      {
        profile: {
          endpoint: 'https://shop.example.com/ucp',
          merchant: {
            name: 'Example shop',
            url: 'https://shop.example.com',
            contact: { email: 'support@example.com' },
          },
          keys: [],
          paymentHandlers: {
            'dev.example.manual': [{ version: '2026-08-25', id: 'pp_system_default' }],
          },
        },
      },
    );

    const response = await server.fetch(new Request('https://shop.example.com/.well-known/ucp'));
    const body: unknown = await response.json();

    expect(body).toMatchObject({
      ucp: {
        payment_handlers: {
          'dev.example.manual': [{ version: '2026-08-25', id: 'pp_system_default' }],
        },
      },
    });
  });

  it('serves a UCP discovery profile at the well-known path', async () => {
    const server = new ReactionaryUCPServer(
      (requestContext) => ({
        productSearch: new TestProductSearchCapability(new MemoryCache(), requestContext),
        cart: new TestCartCapability(new MemoryCache(), requestContext),
      }),
      {
        profile: {
          endpoint: 'https://shop.example.com/ucp',
          merchant: {
            name: 'Example shop',
            url: 'https://shop.example.com',
            contact: {
              email: 'support@example.com',
            },
          },
          keys: [
            {
              kty: 'OKP',
              crv: 'Ed25519',
              kid: 'test-key',
              x: 'test-public-key',
            },
          ],
        },
      },
    );

    const response = await server.fetch(new Request('https://shop.example.com/.well-known/ucp'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ucp: {
        version: '2026-08-25',
        services: {
          'dev.ucp.shopping': [
            {
              version: '2026-08-25',
              transport: 'rest',
              endpoint: 'https://shop.example.com/ucp',
              spec: 'https://ucp.dev/2026-08-25/specification/overview/',
              schema: 'https://ucp.dev/2026-08-25/services/shopping/rest.openapi.json',
            },
          ],
        },
        capabilities: {
          'dev.ucp.shopping.catalog.search': [
            {
              version: '2026-08-25',
            },
          ],
          'dev.ucp.shopping.cart': [
            {
              version: '2026-08-25',
              spec: 'https://ucp.dev/2026-08-25/specification/shopping/cart/',
              schema: 'https://ucp.dev/2026-08-25/schemas/shopping/cart.json',
            },
          ],
        },
      },
      merchant: {
        name: 'Example shop',
      },
      keys: [
        expect.objectContaining({
          kid: 'test-key',
        }),
      ],
    });
  });

  it('serves canonical UCP catalog search over REST', async () => {
    const productSearch = new TestProductSearchCapability(new MemoryCache(), createInitialRequestContext());
    const server = new ReactionaryUCPServer(() => ({
      productSearch,
    }), {
      profile: {
        endpoint: 'https://shop.example.com/ucp',
        merchant: {
          name: 'Example shop',
          url: 'https://shop.example.com',
          contact: { email: 'support@example.com' },
        },
        keys: [],
      },
    });

    const response = await server.fetch(
      new Request('https://shop.example.com/ucp/catalog/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'shirt',
          filters: {
            categories: ['Apparel > Shirts'],
            price: {
              min: 1000,
            },
            brand: ['Reactionary', 'Solteq'],
            in_stock: true,
          },
          pagination: {
            cursor: '5',
            limit: 5,
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ucp: {
        version: '2026-08-25',
        status: 'success',
      },
      products: [
        {
          id: 'product-1',
          title: 'Test product',
          variants: [],
        },
      ],
      pagination: {
        cursor: '10',
        has_next_page: true,
        total_count: 12,
      },
      messages: [
        {
          type: 'warning',
          code: 'price_filter_ignored',
          path: '$.filters.price',
        },
      ],
    });
    expect(productSearch.lastCategoryPath).toMatchObject({
      categoryPath: [
        {
          identifier: { key: 'Apparel' },
          name: 'Apparel',
        },
        {
          identifier: { key: 'Shirts' },
          name: 'Shirts',
        },
      ],
    });
    expect(productSearch.lastPayload).toMatchObject({
      search: {
        categoryFilter: {
          facet: { key: 'categories' },
          key: 'Apparel > Shirts',
        },
        filters: ['brand:Reactionary', 'brand:Solteq', 'in_stock:true'],
        paginationOptions: {
          pageNumber: 2,
          pageSize: 5,
        },
      },
    });
  });

  it('serves canonical UCP cart create and get over REST', async () => {
    const server = new ReactionaryUCPServer((requestContext) => ({
      cart: new TestCartCapability(new MemoryCache(), requestContext),
    }), {
      profile: {
        endpoint: 'https://shop.example.com/ucp',
        merchant: {
          name: 'Example shop',
          url: 'https://shop.example.com',
          contact: { email: 'support@example.com' },
        },
        keys: [],
      },
    });

    const createResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/carts', {
        method: 'POST',
        headers: {
          'Request-Id': 'rest-request-1',
          'Idempotency-Key': 'create-cart-1',
        },
        body: JSON.stringify({
          line_items: [],
        }),
      }),
    );
    const created = await createResponse.json();
    const sessionId = createResponse.headers.get('ucp-session-id');

    const replayResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/carts', {
        method: 'POST',
        headers: {
          'ucp-session-id': sessionId ?? '',
          'Request-Id': 'rest-request-2',
          'Idempotency-Key': 'create-cart-1',
        },
        body: JSON.stringify({
          line_items: [],
        }),
      }),
    );
    const replayed = await replayResponse.json();

    const getResponse = await server.fetch(
      new Request('https://shop.example.com/ucp/carts/cart-created'),
    );
    const fetched = await getResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createResponse.headers.get('Request-Id')).toBe('rest-request-1');
    expect(replayResponse.status).toBe(201);
    expect(replayResponse.headers.get('Request-Id')).toBe('rest-request-2');
    expect(replayed).toEqual(created);
    expect(created).toMatchObject({
      id: 'cart-created',
      ucp: {
        version: '2026-08-25',
        status: 'success',
      },
      currency: 'EUR',
      // UCP amounts are ISO 4217 minor units: 1234.00 EUR.
      totals: [
        {
          type: 'subtotal',
          amount: 123400,
        },
        {
          type: 'total',
          amount: 123400,
        },
      ],
    });
    expect(getResponse.status).toBe(200);
    expect(fetched).toMatchObject({
      id: 'cart-created',
    });
  });

  it('reconciles canonical UCP cart replacement over REST', async () => {
    const cart = new TestCartReconciliationCapability(new MemoryCache(), createInitialRequestContext());
    const server = new ReactionaryUCPServer(() => ({ cart }), {
      profile: {
        endpoint: 'https://shop.example.com/ucp',
        merchant: {
          name: 'Example shop',
          url: 'https://shop.example.com',
          contact: { email: 'support@example.com' },
        },
        keys: [],
      },
    });

    const response = await server.fetch(
      new Request('https://shop.example.com/ucp/carts/cart-reconcile', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'cart-reconcile',
          line_items: [
            {
              id: 'line-change',
              item: {
                id: 'sku-change',
                title: 'Changed',
                price: 100,
              },
              quantity: 3,
              totals: [],
            },
            {
              id: 'line-add',
              item: {
                id: 'sku-add',
                title: 'Added',
                price: 100,
              },
              quantity: 2,
              totals: [],
            },
          ],
          currency: 'EUR',
          totals: [],
          ucp: {
            version: '2026-08-25',
            status: 'success',
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(cart.calls).toEqual([
      {
        method: 'remove',
        payload: {
          cart: { key: 'cart-reconcile' },
          item: { key: 'item-remove' },
        },
      },
      {
        method: 'changeQuantity',
        payload: {
          cart: { key: 'cart-reconcile' },
          item: { key: 'item-change' },
          quantity: 3,
        },
      },
      {
        method: 'add',
        payload: {
          cart: { key: 'cart-reconcile' },
          variant: { sku: 'sku-add' },
          quantity: 2,
        },
      },
    ]);
    expect(body).toMatchObject({
      id: 'cart-reconcile',
      line_items: [
        {
          item: {
            id: 'sku-change',
          },
          quantity: 3,
        },
        {
          item: {
            id: 'sku-add',
          },
          quantity: 2,
        },
      ],
    });
  });

  it('does not expose a generic POST action endpoint', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    const response = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cart.add_item',
          payload: {},
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
      },
    });
  });
});
