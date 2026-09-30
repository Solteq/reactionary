import {
  BaseCapability,
  MemoryCache,
  Reactionary,
  createInitialRequestContext,
  success,
  type Result,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
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
