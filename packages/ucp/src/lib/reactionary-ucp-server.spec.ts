import { MemoryCache, success, type RequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

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
    const server = new ReactionaryUCPServer(() => ({
      productSearch: {
        queryByTerm: async () => success({ items: [] }),
      },
      cart: {
        add: async () => success({ identifier: { key: 'cart-1' } }),
      },
    }));

    const response = await server.fetch(new Request('http://127.0.0.1/ucp'));
    const body = await response.json() as { actions: unknown[] };

    expect(body.actions).toEqual([
      expect.objectContaining({
        name: 'product.search',
        capability: 'productSearch',
        method: 'queryByTerm',
      }),
      expect.objectContaining({
        name: 'cart.add_item',
        capability: 'cart',
        method: 'add',
      }),
    ]);
  });

  it('invokes an available UCP action', async () => {
    const observedPayloads: unknown[] = [];
    const server = new ReactionaryUCPServer(() => ({
      productSearch: {
        queryByTerm: async (payload) => {
          observedPayloads.push(payload);
          return success({
            items: [
              {
                identifier: { key: 'product-1' },
                name: 'Test product',
              },
            ],
          });
        },
      },
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
    expect(observedPayloads).toEqual([{ term: 'shoes' }]);
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
