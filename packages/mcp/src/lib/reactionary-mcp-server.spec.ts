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

describe('ReactionaryMCPServer', () => {
  it('discovers decorated capability methods as MCP tools', () => {
    const capability = new TestProductSearchCapability(
      new MemoryCache(),
      createInitialRequestContext(),
    );
    const server = new ReactionaryMCPServer({ productSearch: capability });

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
    const capability = new TestProductSearchCapability(
      new MemoryCache(),
      createInitialRequestContext(),
    );
    const server = new ReactionaryMCPServer({ productSearch: capability });

    expect(typeof server.getHandler().fetch).toBe('function');
    expect(typeof server.toNodeHandler()).toBe('function');
  });

  it('keeps safe defaults in MCP schemas and omits invalid defaults', async () => {
    const capability = new TestProductSearchCapability(
      new MemoryCache(),
      createInitialRequestContext(),
    );
    const server = new ReactionaryMCPServer({ productSearch: capability });

    const tools = await callMcp(server, 'tools/list');

    expect(tools).toContain('"default":"shoes"');
    expect(tools).toContain('Search phrase');
    expect(tools).toContain('Field with an invalid default factory');
    expect(tools).not.toContain('Broken test default');

    await server.close();
  });
});

async function callMcp(
  server: ReactionaryMCPServer,
  method: string,
): Promise<string> {
  const response = await server.fetch(
    new Request('http://127.0.0.1/mcp', {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: {},
      }),
    }),
  );

  expect(response.status).toBe(200);
  return await response.text();
}
