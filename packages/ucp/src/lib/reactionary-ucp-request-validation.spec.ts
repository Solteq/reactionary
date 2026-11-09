import { request as httpRequest, createServer, type Server } from 'node:http';
import { BaseCapability, MemoryCache, type ProductSearchResult, type Result } from '@reactionary/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReactionaryUCPServer } from './reactionary-ucp-server.js';

class FailingProductSearchCapability extends BaseCapability {
  public async queryByTerm(): Promise<Result<ProductSearchResult>> {
    throw new Error('backend down');
  }

  protected getResourceName(): string {
    return 'product-search';
  }
}

function post(path: string, body: string | null): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === null ? {} : { body }),
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe('UCP request validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ['/carts'],
    ['/carts/cart-1'],
    ['/checkout-sessions'],
    ['/checkout-sessions/session-1/complete'],
    ['/catalog/search'],
    ['/catalog/lookup'],
    ['/catalog/product'],
  ])('%s', (path) => {
    const method = path === '/carts/cart-1' ? 'PUT' : 'POST';
    const send = (body: string) => new ReactionaryUCPServer(() => ({})).fetch(
      new Request(`http://127.0.0.1${path}`, { method, body }),
    );

    it('answers 400 for malformed JSON', async () => {
      const response = await send('{not json');

      expect(response.status).toBe(400);
      expect(await readJson(response)).toMatchObject({ messages: [{ code: 'invalid_json' }] });
    });

    it('answers 422 for a null body', async () => {
      const response = await send('null');

      expect(response.status).toBe(422);
      expect(await readJson(response)).toMatchObject({ messages: [{ code: 'invalid_request' }] });
    });

    it('answers 422 for a JSON array body', async () => {
      expect((await send('[]')).status).toBe(422);
    });
  });

  it('answers 422 for a cart without line_items', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect((await server.fetch(post('/carts', '{}'))).status).toBe(422);
    expect((await server.fetch(post('/carts', null))).status).toBe(422);
    expect((await server.fetch(post('/carts', '{"line_items":"x"}'))).status).toBe(422);
    expect((await server.fetch(post('/carts', '{"line_items":[{"quantity":1}]}'))).status).toBe(422);
    expect((await server.fetch(post('/carts', '{"line_items":[{"item":{"id":"a"},"quantity":"1"}]}'))).status).toBe(422);
  });

  it('answers 422 for a cart update without line_items', async () => {
    const server = new ReactionaryUCPServer(() => ({}));
    const response = await server.fetch(new Request('http://127.0.0.1/carts/cart-1', { method: 'PUT', body: '{}' }));

    expect(response.status).toBe(422);
  });

  it('answers 422 for a catalog lookup without ids', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect((await server.fetch(post('/catalog/lookup', '{}'))).status).toBe(422);
    expect((await server.fetch(post('/catalog/lookup', '{"ids":[1]}'))).status).toBe(422);
  });

  it('answers 422 for a catalog search with a malformed pagination limit', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect((await server.fetch(post('/catalog/search', '{"pagination":{"limit":0}}'))).status).toBe(422);
    expect((await server.fetch(post('/catalog/search', '{"filters":"x"}'))).status).toBe(422);
  });

  it('answers 422 for checkout bodies whose nested fields are primitives', async () => {
    const server = new ReactionaryUCPServer(() => ({}));

    expect((await server.fetch(post('/checkout-sessions', '{"buyer":"x"}'))).status).toBe(422);
    expect((await server.fetch(post('/checkout-sessions', '{"payment":"x"}'))).status).toBe(422);
    expect((await server.fetch(post('/checkout-sessions', '{"payment":{"instruments":["x"]}}'))).status).toBe(422);
    expect((await server.fetch(post('/checkout-sessions/s1/complete', '{"buyer":1}'))).status).toBe(422);
  });

  it('still accepts an empty body where every field is optional', async () => {
    const server = new ReactionaryUCPServer(() => ({}));
    const response = await server.fetch(post('/catalog/search', null));

    expect(response.status).toBe(200);
  });

  it('passes unknown fields through to extensions', async () => {
    const server = new ReactionaryUCPServer(() => ({}));
    const response = await server.fetch(post('/catalog/search', '{"query":"x","context":{"country":"DK"}}'));

    expect(response.status).toBe(200);
  });

  it.each([
    ['GET', '/carts/%E0%A4%A'],
    ['POST', '/carts/%/cancel'],
    ['GET', '/checkout-sessions/%zz'],
    ['GET', '/orders/%'],
  ])('answers 400 for a malformed percent-escape in %s %s', async (method, path) => {
    const server = new ReactionaryUCPServer(() => ({}));
    const response = await server.fetch(new Request(`http://127.0.0.1${path}`, { method }));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ messages: [{ code: 'invalid_request' }] });
  });

  it('answers 500 instead of throwing when the client factory fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const server = new ReactionaryUCPServer(() => {
      throw new Error('boom');
    });

    const response = await server.fetch(post('/catalog/search', '{}'));

    expect(response.status).toBe(500);
    const text = await response.text();

    expect(JSON.parse(text)).toMatchObject({ messages: [{ code: 'internal_error' }] });
    expect(text).not.toContain('boom');
  });

  it('keeps the session state written before a handler failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const observed: unknown[] = [];
    const server = new ReactionaryUCPServer((requestContext) => {
      observed.push(requestContext.session['test.marker']);
      requestContext.session['test.marker'] = 'saved';

      return { productSearch: new FailingProductSearchCapability(new MemoryCache(), requestContext) };
    });

    const first = await server.fetch(post('/catalog/search', '{}'));
    const sessionId = first.headers.get('ucp-session-id');

    expect(first.status).toBe(500);
    expect(sessionId).toBeTruthy();

    await server.fetch(new Request('http://127.0.0.1/catalog/search', {
      method: 'POST',
      headers: { 'ucp-session-id': sessionId ?? '' },
      body: '{}',
    }));

    expect(observed).toEqual([undefined, 'saved']);
  });

  it('answers 500 instead of throwing when a handler fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const server = new ReactionaryUCPServer((requestContext) => ({
      productSearch: new FailingProductSearchCapability(new MemoryCache(), requestContext),
    }));

    const response = await server.fetch(post('/catalog/search', '{}'));

    expect(response.status).toBe(500);
  });
});

describe('UCP Node handler', () => {
  let httpServer: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (!httpServer) {
        resolve();
        return;
      }

      httpServer.close(() => resolve());
      httpServer.closeAllConnections();
    });
    httpServer = undefined;
  });

  async function listen(ucp: ReactionaryUCPServer): Promise<number> {
    const server = createServer(ucp.toNodeHandler());
    httpServer = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The test server is not listening on a TCP port.');
    }

    return address.port;
  }

  function send(port: number, options: { method?: string; path: string; host?: string; body?: string }): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method: options.method ?? 'GET',
          path: options.path,
          headers: options.host === undefined ? {} : { host: options.host },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
        },
      );
      request.on('error', reject);
      request.end(options.body);
    });
  }

  it('answers 400 for a Host header that is not a valid authority', async () => {
    const port = await listen(new ReactionaryUCPServer(() => ({})));

    const response = await send(port, { path: '/carts/cart-1', host: 'bad host' });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({ messages: [{ code: 'invalid_request' }] });
  });

  it('answers 400 for malformed JSON and malformed percent-escapes', async () => {
    const port = await listen(new ReactionaryUCPServer(() => ({})));

    expect((await send(port, { method: 'POST', path: '/carts', body: '{' })).status).toBe(400);
    expect((await send(port, { path: '/carts/%' })).status).toBe(400);
  });

  it('answers 500 rather than leaving an unhandled rejection when serving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    try {
      const port = await listen(new ReactionaryUCPServer(() => {
        throw new Error('boom');
      }));

      expect((await send(port, { path: '/carts/cart-1' })).status).toBe(500);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
