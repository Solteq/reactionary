import {
  BaseCapability,
  MemoryCache,
  Reactionary,
  success,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

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
        },
      ],
    });
  }

  protected getResourceName(): string {
    return 'product-search';
  }
}

class TestCartCapability extends BaseCapability {
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
    return success({ identifier: { key: 'cart-1' } });
  }

  protected getResourceName(): string {
    return 'cart';
  }
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
