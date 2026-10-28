import {
  BaseCapability,
  MemoryCache,
  Reactionary,
  createInitialRequestContext,
  success,
  type Result,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { ReactionaryMCPServer } from './reactionary-mcp-server.js';

class TestProductSearchCapability extends BaseCapability {
  @Reactionary({
    inputSchema: z.object({
      query: z.string().default('shoes').meta({ description: 'Search phrase' }),
      brokenDefault: z
        .string()
        .default(() => {
          throw new Error('Broken test default');
        })
        .meta({ description: 'Field with an invalid default factory' }),
    }),
    outputSchema: z.object({ products: z.array(z.string()) }),
    title: 'Search products',
    description: 'Searches products for testing',
  })
  public async search(input: {
    query: string;
    brokenDefault: string;
  }): Promise<Result<unknown>> {
    return success({ products: [`result:${input.query}`] });
  }

  protected getResourceName(): string {
    return 'productSearch';
  }
}

class TestSessionCapability extends BaseCapability {
  @Reactionary({
    inputSchema: z.object({
      marker: z.string(),
    }),
    outputSchema: z.object({
      marker: z.string(),
    }),
  })
  public async setMarker(input: { marker: string }): Promise<Result<unknown>> {
    this.context.session['test.marker'] = input.marker;
    return success({ marker: input.marker });
  }

  @Reactionary({
    inputSchema: z.undefined(),
    outputSchema: z.object({
      marker: z.string().optional(),
    }),
  })
  public async getMarker(): Promise<Result<unknown>> {
    return success({
      marker: this.context.session['test.marker'],
    });
  }

  protected getResourceName(): string {
    return 'sessionTest';
  }
}

class TestVoidCapability extends BaseCapability {
  @Reactionary({
    inputSchema: z.undefined(),
    outputSchema: z.void(),
  })
  public async ping(): Promise<Result<unknown>> {
    return success(undefined);
  }

  protected getResourceName(): string {
    return 'voidTest';
  }
}

describe('ReactionaryMCPServer', () => {
  it('discovers decorated capability methods as MCP tools', () => {
    const server = new ReactionaryMCPServer(createTestClient);

    expect(server.discoverTools()).toMatchObject([
      {
        name: 'productSearch.search',
        entrypoint: {
          capabilityName: 'productSearch',
          methodName: 'search',
          title: 'Search products',
          description: 'Searches products for testing',
        },
      },
    ]);
  });

  it('creates a web-standard MCP HTTP handler', () => {
    const server = new ReactionaryMCPServer(createTestClient);

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('supports creating isolated clients from a factory', () => {
    const createdCapabilities: TestProductSearchCapability[] = [];
    const server = new ReactionaryMCPServer((requestContext) => {
      const capability = new TestProductSearchCapability(
        new MemoryCache(),
        requestContext,
      );
      createdCapabilities.push(capability);

      return { productSearch: capability };
    });

    expect(server.discoverTools()).toHaveLength(1);
    expect(server.discoverTools()).toHaveLength(1);
    expect(createdCapabilities).toHaveLength(2);
    expect(createdCapabilities[0]).not.toBe(createdCapabilities[1]);
  });

  it('persists request context session state for the MCP session', async () => {
    const sessionCache = new MemoryCache();
    const server = new ReactionaryMCPServer(
      (requestContext) => ({
        sessionTest: new TestSessionCapability(new MemoryCache(), {
          ...requestContext,
        }),
      }),
      { sessionCache },
    );

    const setResponse = await callMcpResponse(server, 'tools/call', {
      name: 'sessionTest.setMarker',
      arguments: { marker: 'session-value' },
    });
    const sessionId = setResponse.headers.get('mcp-session-id');

    expect(sessionId).toBeTruthy();

    const getResponse = await callMcpResponse(
      server,
      'tools/call',
      {
        name: 'sessionTest.getMarker',
        arguments: {},
      },
      { 'mcp-session-id': sessionId ?? '' },
    );

    await expect(getResponse.text()).resolves.toContain('session-value');
    await server.close();
  });

  it('returns protocol-valid structured content for void tools', async () => {
    const server = new ReactionaryMCPServer((requestContext) => ({
      voidTest: new TestVoidCapability(new MemoryCache(), requestContext),
    }));

    const response = await callMcpResponse(server, 'tools/call', {
      name: 'voidTest.ping',
      arguments: {},
    });
    const body = await response.text();

    expect(body).toContain('"structuredContent":{"value":null}');
    expect(body).toContain('"text":"{\\"value\\":null}"');

    await server.close();
  });

  it('keeps safe defaults in MCP schemas and omits invalid defaults', async () => {
    const server = new ReactionaryMCPServer(createTestClient);

    const tools = await callMcp(server, 'tools/list');

    expect(tools).toContain('"default":"shoes"');
    expect(tools).toContain('Search phrase');
    expect(tools).toContain('Field with an invalid default factory');
    expect(tools).not.toContain('Broken test default');

    await server.close();
  });
});

describe('ReactionaryMCPServer request screening', () => {
  const requestFor = (headers: Record<string, string>): Request =>
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

  it('serves any host and origin unless screening is configured', async () => {
    const server = new ReactionaryMCPServer(createTestClient);

    const response = await server.fetch(
      requestFor({ host: 'evil.example', origin: 'https://evil.example' }),
    );

    expect(response.status).toBe(200);
    await server.close();
  });

  describe('allowedHostnames', () => {
    it('rejects a foreign Host header before any client is created', async () => {
      const clientFactory = vi.fn(createTestClient);
      const server = new ReactionaryMCPServer(clientFactory, {
        allowedHostnames: ['localhost', '127.0.0.1'],
      });

      // The hostname a DNS rebinding attack resolves to loopback.
      const response = await server.fetch(
        requestFor({ host: 'rebind.evil.example:3000' }),
      );

      expect(response.status).toBe(403);
      expect(clientFactory).not.toHaveBeenCalled();
      await server.close();
    });

    it('rejects a request without a Host header', async () => {
      const server = new ReactionaryMCPServer(createTestClient, {
        allowedHostnames: ['localhost'],
      });

      expect((await server.fetch(requestFor({}))).status).toBe(403);
      await server.close();
    });

    it('serves an allowed Host header, ignoring the port', async () => {
      const server = new ReactionaryMCPServer(createTestClient, {
        allowedHostnames: ['localhost', '[::1]'],
      });

      for (const host of ['localhost:3000', '[::1]:3000']) {
        expect((await server.fetch(requestFor({ host }))).status).toBe(200);
      }
      await server.close();
    });
  });

  describe('allowedOriginHostnames', () => {
    it('rejects a cross-site Origin before any client is created', async () => {
      const clientFactory = vi.fn(createTestClient);
      const server = new ReactionaryMCPServer(clientFactory, {
        allowedOriginHostnames: ['localhost'],
      });

      for (const origin of ['https://evil.example', 'null']) {
        const response = await server.fetch(requestFor({ origin }));
        expect(response.status).toBe(403);
      }
      expect(clientFactory).not.toHaveBeenCalled();
      await server.close();
    });

    it('serves an allowed Origin and requests without one', async () => {
      const server = new ReactionaryMCPServer(createTestClient, {
        allowedOriginHostnames: ['localhost'],
      });

      const allowedHeaders: Record<string, string>[] = [
        { origin: 'http://localhost:5173' },
        {},
      ];
      for (const headers of allowedHeaders) {
        expect((await server.fetch(requestFor(headers))).status).toBe(200);
      }
      await server.close();
    });
  });

  describe('authorize', () => {
    it('answers 401 before any client is created when the hook denies', async () => {
      const clientFactory = vi.fn(createTestClient);
      const authorize = vi.fn(() => false);
      const server = new ReactionaryMCPServer(clientFactory, { authorize });

      const response = await server.fetch(requestFor({}));

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(authorize).toHaveBeenCalledOnce();
      expect(clientFactory).not.toHaveBeenCalled();
      await server.close();
    });

    it('serves requests the hook accepts, passing it the request', async () => {
      const server = new ReactionaryMCPServer(createTestClient, {
        authorize: async (request) =>
          request.headers.get('authorization') === 'Bearer secret',
      });

      const denied = await server.fetch(
        requestFor({ authorization: 'Bearer wrong' }),
      );
      const allowed = await server.fetch(
        requestFor({ authorization: 'Bearer secret' }),
      );

      expect(denied.status).toBe(401);
      expect(allowed.status).toBe(200);
      await server.close();
    });

    it('denies and reports when the hook throws', async () => {
      const onerror = vi.fn();
      const server = new ReactionaryMCPServer(createTestClient, {
        authorize: () => {
          throw new Error('token store down');
        },
        handler: { onerror },
      });

      expect((await server.fetch(requestFor({}))).status).toBe(401);
      expect(onerror).toHaveBeenCalledWith(new Error('token store down'));
      await server.close();
    });

    it('runs after host validation', async () => {
      const authorize = vi.fn(() => true);
      const server = new ReactionaryMCPServer(createTestClient, {
        allowedHostnames: ['localhost'],
        authorize,
      });

      expect(
        (await server.fetch(requestFor({ host: 'evil.example' }))).status,
      ).toBe(403);
      expect(authorize).not.toHaveBeenCalled();
      await server.close();
    });
  });

  it('applies screening to the node and handler entry points', async () => {
    const server = new ReactionaryMCPServer(createTestClient, {
      allowedHostnames: ['localhost'],
    });

    const response = await server
      .getHandler()
      .fetch(requestFor({ host: 'evil.example' }));

    expect(response.status).toBe(403);
    await server.close();
  });
});

describe('ReactionaryMCPServer toolFilter', () => {
  it('only registers tools the filter accepts', async () => {
    const server = new ReactionaryMCPServer(createTestClient, {
      toolFilter: (tool) => tool.name !== 'productSearch.search',
    });

    expect(server.discoverTools()).toEqual([]);
    const tools = await callMcp(server, 'tools/list');
    expect(tools).not.toContain('productSearch.search');
    await server.close();
  });

  it('receives the tool with its final name', () => {
    const toolFilter = vi.fn(() => true);
    const server = new ReactionaryMCPServer(createTestClient, {
      toolName: (capabilityName, methodName) =>
        `x.${capabilityName}.${methodName}`,
      toolFilter,
    });

    server.discoverTools();

    expect(toolFilter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'x.productSearch.search' }),
    );
  });
});

function createTestClient(requestContext = createInitialRequestContext()) {
  return {
    productSearch: new TestProductSearchCapability(
      new MemoryCache(),
      requestContext,
    ),
  };
}

async function callMcp(
  server: ReactionaryMCPServer,
  method: string,
): Promise<string> {
  const response = await callMcpResponse(server, method);

  return await response.text();
}

async function callMcpResponse(
  server: ReactionaryMCPServer,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<Response> {
  const response = await server.fetch(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    }),
  );

  expect(response.status).toBe(200);
  return response;
}
