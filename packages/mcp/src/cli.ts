#!/usr/bin/env node
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { localhostAllowedHostnames } from '@modelcontextprotocol/server';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import { ReactionaryMCPServer } from './lib/reactionary-mcp-server.js';
import type { ReactionaryMCPTool } from './lib/tool-discovery.js';
import {
  createReactionaryClientFromEnv,
  getEnabledReactionaryMCPProviderSystems,
  getNoEnabledProviderSystemsMessage,
} from './lib/env-client-builder.js';
import { loadProjectRootEnv } from './lib/load-project-root-env.js';

export interface CliOptions {
  host: string;
  port: number;
  path: string;
  /** Hostnames accepted in the Host header (DNS rebinding protection). */
  allowedHosts: string[];
  /** Hostnames accepted in the Origin header of browser requests. */
  allowedOrigins: string[];
  /** Bearer token clients must present. Read from MCP_AUTH_TOKEN only, so it never shows up in the process list. */
  authToken?: string;
  /** Capabilities whose tools are exposed. Undefined exposes every capability the environment enables. */
  capabilities?: string[];
}

/**
 * The tools exposed unless the operator opts in to more: read-only catalogue access. Everything else (cart, checkout, identity,
 * order, employee, company, ...) changes state or reveals customer data, and runs with the provider credentials of the server.
 */
export const READ_ONLY_CAPABILITIES = [
  'product-search',
  'product',
  'price',
  'inventory',
  'category',
];

const BOOLEAN_FLAGS = new Set(['allow-insecure-remote', 'enable-mutating-tools']);

async function main(): Promise<void> {
  loadProjectRootEnv(import.meta.url);

  const options = parseOptions(process.argv.slice(2), process.env);
  const enabledSystems = getEnabledReactionaryMCPProviderSystems();

  if (enabledSystems.length === 0) {
    throw new Error(getNoEnabledProviderSystemsMessage());
  }

  const mcp = new ReactionaryMCPServer(
    (requestContext) =>
      createReactionaryClientFromEnv({
        contextOverrides: requestContext,
      }).client,
    {
      name: process.env['MCP_SERVER_NAME'] || '@reactionary/mcp',
      version: process.env['MCP_SERVER_VERSION'] || '0.0.1',
      allowedHostnames: options.allowedHosts,
      allowedOriginHostnames: options.allowedOrigins,
      authorize: options.authToken
        ? createBearerTokenAuthorizer(options.authToken)
        : undefined,
      toolFilter: createToolFilter(options.capabilities),
      handler: {
        onerror: (error) => {
          console.error(error);
        },
      },
    },
  );
  const server = createHttpServer(mcp.toNodeHandler(), options.path);

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.host, resolve);
  });

  console.error(
    `Reactionary MCP server listening on http://${options.host}:${options.port}${options.path}`,
  );
  console.error(`Enabled systems: ${enabledSystems.join(', ')}`);
  console.error(
    `Exposed capabilities: ${options.capabilities?.join(', ') ?? 'all'}`,
  );
  console.error(`Allowed hosts: ${options.allowedHosts.join(', ')}`);
  console.error(
    options.authToken
      ? 'Bearer token authentication is required.'
      : 'WARNING: no authentication is configured (set MCP_AUTH_TOKEN).',
  );

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

export function parseOptions(
  args: string[],
  env: NodeJS.ProcessEnv,
): CliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);

    if (BOOLEAN_FLAGS.has(rawKey)) {
      values.set(rawKey, inlineValue ?? 'true');
      continue;
    }

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

  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  if (!path.startsWith('/')) {
    throw new Error(`MCP path must start with "/": ${path}`);
  }

  const allowInsecureRemote = isFlagEnabled(
    values.get('allow-insecure-remote') ?? env['MCP_ALLOW_INSECURE_REMOTE'],
  );
  const enableMutatingTools = isFlagEnabled(
    values.get('enable-mutating-tools') ?? env['MCP_ENABLE_MUTATING_TOOLS'],
  );
  const authToken = env['MCP_AUTH_TOKEN'] || undefined;

  const allowedHosts = parseList(
    values.get('allowed-hosts') ?? env['MCP_ALLOWED_HOSTS'],
  ) ?? getDefaultAllowedHosts(host);
  const allowedOrigins =
    parseList(
      values.get('allowed-origins') ?? env['MCP_ALLOWED_ORIGINS'],
    ) ?? allowedHosts;

  const explicitCapabilities = parseList(
    values.get('capabilities') ?? env['MCP_CAPABILITIES'],
  );
  if (explicitCapabilities && enableMutatingTools) {
    throw new Error(
      'Use either --capabilities or --enable-mutating-tools, not both.',
    );
  }
  const capabilities = enableMutatingTools
    ? undefined
    : (explicitCapabilities ?? READ_ONLY_CAPABILITIES);

  if (!isLoopbackHost(host) && !authToken && !allowInsecureRemote) {
    throw new Error(
      `Refusing to listen on non-loopback host ${host} without authentication. ` +
        'Set MCP_AUTH_TOKEN to require a bearer token, or pass --allow-insecure-remote ' +
        'to serve an unauthenticated endpoint on purpose.',
    );
  }

  return {
    host,
    port,
    path,
    allowedHosts,
    allowedOrigins,
    authToken,
    capabilities,
  };
}

/**
 * Serves the MCP handler on `path` and answers everything else with 404. The request target is parsed from `request.url`
 * alone, and a Host header that is not a valid authority is answered with 400, because both are client controlled and must
 * not be able to make request handling throw.
 */
export function createHttpServer(
  mcpHandler: NodeMcpRequestHandler,
  path: string,
): Server {
  const server = createServer(async (request, response) => {
    try {
      const pathname = parsePathname(request.url, request.headers.host);

      if (pathname === undefined) {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Bad request');
        return;
      }

      if (pathname !== path) {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Not found');
        return;
      }

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

  return server;
}

/** Accepts requests carrying `Authorization: Bearer <token>`, comparing in constant time. */
export function createBearerTokenAuthorizer(
  token: string,
): (request: Request) => boolean {
  const expected = sha256(token);

  return (request) => {
    const match = /^Bearer\s+(.+)$/i.exec(
      request.headers.get('authorization') ?? '',
    );

    return match !== null && timingSafeEqual(sha256(match[1]), expected);
  };
}

/** Exposes only the tools of the given capabilities, or every tool when no capabilities are given. */
export function createToolFilter(
  capabilities: string[] | undefined,
): ((tool: ReactionaryMCPTool) => boolean) | undefined {
  if (!capabilities) {
    return undefined;
  }

  const allowed = new Set(capabilities);
  return (tool) => allowed.has(tool.entrypoint.capabilityName);
}

/** The path of a request target, or undefined when the target or the Host header is malformed. */
function parsePathname(
  target: string | undefined,
  hostHeader: string | undefined,
): string | undefined {
  try {
    if (hostHeader !== undefined) {
      new URL(`http://${hostHeader}`);
    }

    return new URL(target ?? '/', 'http://localhost').pathname;
  } catch {
    return undefined;
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isFlagEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function parseList(value: string | undefined): string[] | undefined {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : undefined;
}

function isLoopbackHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/** Loopback names, plus the address the server binds to when it is a specific one (not a wildcard such as 0.0.0.0 or ::). */
function getDefaultAllowedHosts(host: string): string[] {
  const hostnames = localhostAllowedHostnames();
  const isWildcard = host === '0.0.0.0' || host === '::' || host === '[::]';
  const bracketedHost =
    host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

  return isWildcard || hostnames.includes(bracketedHost)
    ? hostnames
    : [...hostnames, bracketedHost];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
