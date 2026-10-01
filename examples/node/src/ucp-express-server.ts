#!/usr/bin/env node
import express from 'express';
import { fileURLToPath } from 'node:url';
import {
  createReactionaryClientFromEnv,
  getEnabledReactionaryMCPProviderSystems,
  getNoEnabledProviderSystemsMessage,
  loadProjectRootEnv,
} from '@reactionary/mcp';
import {
  ReactionaryUCPServer,
  type ReactionaryUCPProfile,
  type ReactionaryUCPProfileOptions,
} from '@reactionary/ucp';

interface ExpressUCPOptions {
  host: string;
  port: number;
  path: string;
  endpoint: string;
  profile: ReactionaryUCPProfileOptions;
}

async function main(): Promise<void> {
  loadProjectRootEnv(import.meta.url);

  const options = parseOptions(process.argv.slice(2), process.env);
  const enabledSystems = getEnabledReactionaryMCPProviderSystems();

  if (enabledSystems.length === 0) {
    throw new Error(getNoEnabledProviderSystemsMessage());
  }

  const ucp = new ReactionaryUCPServer(
    (requestContext) =>
      createReactionaryClientFromEnv({
        contextOverrides: requestContext,
      }).client,
    {
      profile: options.profile,
    },
  );
  const ucpHandler = ucp.toNodeHandler();
  const app = express();

  app.use(async (request, response, next) => {
    if (!isUcpRequest(request.originalUrl, request.headers.host, options.path)) {
      next();
      return;
    }

    try {
      await ucpHandler(request, response);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) {
        response.status(500).type('text/plain; charset=utf-8');
      }
      response.end('Internal server error');
    }
  });

  app.use((_request, response) => {
    response.status(404).type('text/plain; charset=utf-8').send('Not found');
  });

  const server = app.listen(options.port, options.host, () => {
    console.error(
      `Reactionary UCP Express server listening on http://${options.host}:${options.port}${options.path}`,
    );
    console.error(`UCP discovery profile: ${getDiscoveryUrl(options.endpoint)}`);
    console.error(`Enabled systems: ${enabledSystems.join(', ')}`);
  });

  const close = async (): Promise<void> => {
    await ucp.close();
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
): ExpressUCPOptions {
  const values = parseCliArgs(args);
  const host = values.get('host') ?? env['UCP_HOST'] ?? '127.0.0.1';
  const path = values.get('path') ?? env['UCP_PATH'] ?? '/ucp';
  const rawPort = values.get('port') ?? env['UCP_PORT'] ?? env['PORT'] ?? '3000';

  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  if (!path.startsWith('/')) {
    throw new Error(`UCP path must start with "/": ${path}`);
  }

  const endpoint =
    values.get('endpoint') ??
    env['UCP_ENDPOINT'] ??
    env['UCP_PUBLIC_URL'] ??
    `http://${host}:${port}${path}`;

  return {
    host,
    port,
    path,
    endpoint,
    profile: {
      endpoint,
      merchant: {
        name: env['UCP_MERCHANT_NAME'] ?? 'Reactionary',
        url: env['UCP_MERCHANT_URL'] ?? endpoint,
        contact: {
          email: env['UCP_MERCHANT_CONTACT_EMAIL'] ?? 'support@example.com',
          ...(env['UCP_MERCHANT_CONTACT_PHONE']
            ? { phone_number: env['UCP_MERCHANT_CONTACT_PHONE'] }
            : {}),
        },
      },
      keys: parsePublicKeys(env['UCP_PUBLIC_KEYS_JSON']),
    },
  };
}

function parseCliArgs(args: string[]): Map<string, string> {
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

  return values;
}

function isUcpRequest(
  originalUrl: string,
  host: string | undefined,
  path: string,
): boolean {
  const requestUrl = new URL(originalUrl, `http://${host ?? 'localhost'}`);
  const normalizedPath = path.replace(/\/$/, '');

  return (
    requestUrl.pathname === '/.well-known/ucp' ||
    requestUrl.pathname === normalizedPath ||
    requestUrl.pathname.startsWith(`${normalizedPath}/`)
  );
}

function getDiscoveryUrl(
  endpoint: string,
): string {
  return new URL('/.well-known/ucp', endpoint).toString();
}

function parsePublicKeys(
  value: string | undefined,
): ReactionaryUCPProfile['keys'] {
  if (!value) {
    return [];
  }

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    throw new Error('UCP_PUBLIC_KEYS_JSON must be a JSON array of public JWK objects.');
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
