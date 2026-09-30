import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createReactionaryClientFromEnv } from './env-client-builder.js';
import { resolveProjectRootEnvPath } from './load-project-root-env.js';
import { ReactionaryMCPServer } from './reactionary-mcp-server.js';
import {
  REACTIONARY_SHOPPING_AGENT_GUIDE_PROMPT,
  REACTIONARY_SHOPPING_AGENT_GUIDE_URI,
} from './shopping-agent-guide.js';
import { discoverReactionaryMCPTools } from './tool-discovery.js';

describe('createReactionaryClientFromEnv', () => {
  it('resolves the repo root .env path from the MCP source tree', () => {
    expect(resolveProjectRootEnvPath(import.meta.url)).toBe(
      join(resolve(dirname(fileURLToPath(import.meta.url)), '../../../..'), '.env'),
    );
  });

  it('requires at least one enabled provider system', () => {
    expect(() => createReactionaryClientFromEnv({ env: {} })).toThrow(
      'No Reactionary provider system is enabled',
    );
  });

  it('builds an MCP-discoverable client for enabled fake capabilities', () => {
    const { client, enabledSystems } = createReactionaryClientFromEnv({
      env: { ENABLED_FAKE: 'true' },
    });

    expect(enabledSystems).toEqual(['FAKE']);
    expect(discoverReactionaryMCPTools(client).map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'product.getBySKU',
        'price.getListPrice',
        'inventory.getBySKU',
      ]),
    );
  });

  it('serves MCP initialize for a fake-backed client', async () => {
    const { client } = createReactionaryClientFromEnv({
      env: { ENABLED_FAKE: 'true' },
    });
    const server = new ReactionaryMCPServer(client);
    const response = await server.fetch(
      new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: 'test',
              version: '0.0.0',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('"protocolVersion"');
    await server.close();
  });

  it('exposes the shopping guide as an MCP resource and prompt', async () => {
    const { client } = createReactionaryClientFromEnv({
      env: { ENABLED_FAKE: 'true' },
    });
    const server = new ReactionaryMCPServer(client);

    const resources = await callMcp(server, 'resources/list');
    expect(resources).toContain(REACTIONARY_SHOPPING_AGENT_GUIDE_URI);

    const resource = await callMcp(server, 'resources/read', {
      uri: REACTIONARY_SHOPPING_AGENT_GUIDE_URI,
    });
    expect(resource).toContain('Recommended cart flow');

    const prompts = await callMcp(server, 'prompts/list');
    expect(prompts).toContain(REACTIONARY_SHOPPING_AGENT_GUIDE_PROMPT);

    const prompt = await callMcp(server, 'prompts/get', {
      name: REACTIONARY_SHOPPING_AGENT_GUIDE_PROMPT,
      arguments: {},
    });
    expect(prompt).toContain('General safety rules');

    await server.close();
  });
});

async function callMcp(
  server: ReactionaryMCPServer,
  method: string,
  params: Record<string, unknown> = {},
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
        params,
      }),
    }),
  );

  expect(response.status).toBe(200);
  return await response.text();
}
