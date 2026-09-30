#!/usr/bin/env node
import { createServer } from 'node:http';
import { ReactionaryMCPServer } from './lib/reactionary-mcp-server.js';
import { createReactionaryClientFromEnv } from './lib/env-client-builder.js';
import { loadProjectRootEnv } from './lib/load-project-root-env.js';

loadProjectRootEnv(import.meta.url);

interface CliOptions {
  host: string;
  port: number;
  path: string;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2), process.env);
  const { client, enabledSystems } = createReactionaryClientFromEnv();
  const mcp = new ReactionaryMCPServer(client, {
    name: process.env['MCP_SERVER_NAME'] || '@reactionary/mcp',
    version: process.env['MCP_SERVER_VERSION'] || '0.0.1',
    handler: {
      onerror: (error) => {
        console.error(error);
      },
    },
  });
  const mcpHandler = mcp.toNodeHandler();

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? `${options.host}:${options.port}`}`,
    );

    if (requestUrl.pathname !== options.path) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    try {
      await mcpHandler(request, response);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        response.writeHead(500, {
          'content-type': 'text/plain; charset=utf-8',
        });
      }
      response.end('Internal server error');
    }
  });

  server.on('clientError', (error, socket) => {
    console.error(error);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.host, resolve);
  });

  console.error(
    `Reactionary MCP server listening on http://${options.host}:${options.port}${options.path}`,
  );
  console.error(`Enabled systems: ${enabledSystems.join(', ')}`);

  const close = async (): Promise<void> => {
    await mcp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  process.once('SIGINT', () => {
    void close().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void close().finally(() => process.exit(0));
  });
}

function parseOptions(args: string[], env: NodeJS.ProcessEnv): CliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for argument: ${arg}`);
    }

    values.set(rawKey, value);
    if (inlineValue === undefined) {
      index += 1;
    }
  }

  const host = values.get('host') ?? env['MCP_HOST'] ?? '127.0.0.1';
  const path = values.get('path') ?? env['MCP_PATH'] ?? '/mcp';
  const rawPort = values.get('port') ?? env['MCP_PORT'] ?? env['PORT'] ?? '3000';
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  if (!path.startsWith('/')) {
    throw new Error(`MCP path must start with "/": ${path}`);
  }

  return { host, port, path };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
