import {
  BaseCapability,
  createInitialRequestContext,
  MemoryCache,
  Reactionary,
  success,
  type Cache,
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
  @Reactionary({
    inputSchema: z.object({
      term: z.string().meta({ description: 'Configured project search term' }),
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
  public async queryByTerm(payload: unknown): Promise<Result<unknown>> {
    this.context.session['test.lastSearch'] = payload;
    return success({
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

  protected getResourceName(): string {
    return 'product-search';
  }
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
  public async add(): Promise<Result<unknown>> {
    this.onAdd?.();
    return success(createTestCart('cart-created'));
  }

  @Reactionary({
    inputSchema: z.object({
      key: z.string().optional(),
    }),
    outputSchema: TestCartOutputSchema,
  })
  public async createCart(): Promise<Result<unknown>> {
    return success(createTestCart('cart-created'));
  }

  @Reactionary({
    inputSchema: z.object({
      cart: z.object({ key: z.string() }),
    }),
    outputSchema: TestCartOutputSchema,
  })
  public async getById(): Promise<Result<unknown>> {
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

  public async getById(): Promise<Result<unknown>> {
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-remove', 'sku-remove', 1),
      createTestCartItem('item-change', 'sku-change', 1),
    ]));
  }

  public async remove(payload: unknown): Promise<Result<unknown>> {
    this.calls.push({ method: 'remove', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 1),
    ]));
  }

  public async changeQuantity(payload: unknown): Promise<Result<unknown>> {
    this.calls.push({ method: 'changeQuantity', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 3),
    ]));
  }

  public async add(payload: unknown): Promise<Result<unknown>> {
    this.calls.push({ method: 'add', payload });
    return success(createTestCart('cart-reconcile', [
      createTestCartItem('item-change', 'sku-change', 3),
      createTestCartItem('item-add', 'sku-add', 2),
    ]));
  }

  protected getResourceName(): string {
    return 'cart';
  }
}

class TestCheckoutUpdateCapability extends BaseCapability {
  public addPaymentInstructionPayload: unknown;

  public async getById(): Promise<Result<unknown>> {
    return success(createTestCheckout('checkout-update'));
  }

  public async addPaymentInstruction(payload: unknown): Promise<Result<unknown>> {
    this.addPaymentInstructionPayload = payload;
    return success(createTestCheckout('checkout-update'));
  }

  protected getResourceName(): string {
    return 'checkout';
  }
}

function createTestCart(
  id: string,
  items: unknown[] = [],
): unknown {
  return {
    identifier: { key: id },
    items,
    price: {
      grandTotal: {
        value: 1234,
        currency: 'EUR',
      },
    },
  };
}

function createTestCartItem(
  id: string,
  sku: string,
  quantity: number,
): unknown {
  return {
    identifier: { key: id },
    variant: { sku },
    quantity,
    price: {
      unitPrice: {
        value: 100,
        currency: 'EUR',
      },
      totalPrice: {
        value: 100 * quantity,
        currency: 'EUR',
      },
    },
  };
}

function createTestCheckout(id: string): unknown {
  return {
    identifier: { key: id },
    items: [],
    price: {
      grandTotal: {
        value: 1234,
        currency: 'EUR',
      },
    },
    readyForFinalization: false,
  };
}

describe('ReactionaryUCPServer', () => {
  it('creates fetch and Node handlers', () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('serves a framework readiness response', async () => {
    const server = new ReactionaryUCPServer(() => ({}), {
      name: 'test-ucp',
      version: '1.2.3',
    });

    const response = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('ucp-session-id')).toBeTruthy();
    expect(body).toEqual({
      name: 'test-ucp',
      version: '1.2.3',
      protocol: 'ucp',
      status: 'ready',
      actions: [],
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
    const server = new ReactionaryUCPServer((requestContext) => ({
      productSearch: new TestProductSearchCapability(new MemoryCache(), requestContext),
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
          pagination: {
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
      totals: [
        {
          type: 'total',
          amount: 1234,
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

  it('composes canonical UCP checkout replacement over REST', async () => {
    const checkout = new TestCheckoutUpdateCapability(new MemoryCache(), createInitialRequestContext());
    const server = new ReactionaryUCPServer(() => ({ checkout }), {
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
      new Request('https://shop.example.com/ucp/checkout-sessions/checkout-update', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'checkout-update',
          status: 'incomplete',
          line_items: [],
          currency: 'EUR',
          totals: [],
          links: [],
          payment: {
            instruments: [
              {
                id: 'instrument-1',
                handler_id: 'stripe',
                type: 'card',
                selected: true,
              },
            ],
          },
          ucp: {
            version: '2026-08-25',
            status: 'success',
            payment_handlers: {},
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(checkout.addPaymentInstructionPayload).toEqual({
      checkout: { key: 'checkout-update' },
      paymentInstruction: {
        amount: {
          value: 1234,
          currency: 'EUR',
        },
        paymentMethod: {
          method: 'card',
          name: 'instrument-1',
          paymentProcessor: 'stripe',
        },
        protocolData: [
          { key: 'ucp_payment_instrument_id', value: 'instrument-1' },
          { key: 'ucp_payment_handler_id', value: 'stripe' },
          { key: 'ucp_payment_instrument_type', value: 'card' },
        ],
      },
    });
    expect(body).toMatchObject({
      id: 'checkout-update',
      status: 'incomplete',
    });
  });

  it('discovers available UCP actions from client capabilities', async () => {
    const server = new ReactionaryUCPServer((requestContext) => ({
      productSearch: new TestProductSearchCapability(new MemoryCache(), requestContext),
      cart: new TestCartCapability(new MemoryCache(), requestContext),
    }));

    const response = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const body = await response.json() as {
      actions: Array<{
        name: string;
        capability: string;
        method: string;
        title: string;
        inputSchema?: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
      }>;
    };

    expect(body.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'product.search',
        capability: 'product-search',
        method: 'queryByTerm',
        title: 'Search products',
        inputSchema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            term: expect.objectContaining({
              description: 'Configured project search term',
            }),
          }),
        }),
        outputSchema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            items: expect.any(Object),
          }),
        }),
      }),
      expect.objectContaining({
        name: 'cart.add_item',
        capability: 'cart',
        method: 'add',
      }),
    ]));
  });

  it('invokes an available UCP action', async () => {
    const server = new ReactionaryUCPServer((requestContext) => ({
      productSearch: new TestProductSearchCapability(new MemoryCache(), requestContext),
    }));

    const response = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        body: JSON.stringify({
          action: 'product.search',
          payload: {
            term: 'shoes',
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      action: 'product.search',
      success: true,
      value: {
        items: [
          {
            identifier: { key: 'product-1' },
            name: 'Test product',
          },
        ],
      },
    });
  });

  it('echoes request ids and replays mutating actions by idempotency key within a session', async () => {
    let addCalls = 0;
    const server = new ReactionaryUCPServer(
      (requestContext) => ({
        cart: new TestCartCapability(
          new MemoryCache(),
          requestContext,
          () => {
            addCalls += 1;
          },
        ),
      }),
      { sessionCache: new MemoryCache() },
    );
    const payload = {
      action: 'cart.add_item',
      idempotency_key: 'add-sku-1',
      payload: {
        sku: 'sku-1',
        quantity: 1,
      },
    };

    const firstResponse = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        body: JSON.stringify({
          request_id: 'request-1',
          ...payload,
        }),
      }),
    );
    const sessionId = firstResponse.headers.get('ucp-session-id');
    const firstBody = await firstResponse.json();

    const secondResponse = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        headers: {
          'ucp-session-id': sessionId ?? '',
        },
        body: JSON.stringify({
          request_id: 'request-2',
          ...payload,
        }),
      }),
    );
    const secondBody = await secondResponse.json();

    expect(addCalls).toBe(1);
    expect(firstBody).toMatchObject({
      request_id: 'request-1',
      idempotency_key: 'add-sku-1',
      action: 'cart.add_item',
      success: true,
    });
    expect(secondBody).toMatchObject({
      request_id: 'request-2',
      idempotency_key: 'add-sku-1',
      action: 'cart.add_item',
      success: true,
      value: {
        identifier: { key: 'cart-created' },
      },
    });
  });

  it('rejects idempotency key reuse for a different mutating action', async () => {
    const server = new ReactionaryUCPServer(
      (requestContext) => ({
        cart: new TestCartCapability(new MemoryCache(), requestContext),
      }),
      { sessionCache: new MemoryCache() },
    );

    const firstResponse = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        body: JSON.stringify({
          action: 'cart.add_item',
          idempotency_key: 'cart-mutation-1',
          payload: {
            sku: 'sku-1',
            quantity: 1,
          },
        }),
      }),
    );
    const sessionId = firstResponse.headers.get('ucp-session-id');

    const secondResponse = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        headers: {
          'ucp-session-id': sessionId ?? '',
        },
        body: JSON.stringify({
          action: 'cart.create',
          idempotency_key: 'cart-mutation-1',
          payload: {
            key: 'new-cart',
          },
        }),
      }),
    );
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(409);
    expect(secondBody).toMatchObject({
      idempotency_key: 'cart-mutation-1',
      error: {
        code: 'IDEMPOTENCY_KEY_CONFLICT',
      },
    });
  });

  it('returns a structured error for invalid UCP action requests', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    const response = await server.fetch(
      new Request('http://127.0.0.1/ucp', {
        method: 'POST',
        body: JSON.stringify({ payload: {} }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'INVALID_UCP_ACTION_REQUEST',
      },
    });
  });

  it('returns a structured error for unavailable UCP actions', async () => {
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
        code: 'UCP_ACTION_NOT_AVAILABLE',
      },
    });
  });
});
