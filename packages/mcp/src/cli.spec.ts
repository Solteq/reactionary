import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request as httpRequest, createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BaseCapability,
  MemoryCache,
  Reactionary,
  createInitialRequestContext,
  success,
  type Result,
} from '@reactionary/core';
import { afterEach, describe, expect, it } from 'vitest';
import * as z from 'zod';
import {
  createBearerTokenAuthorizer,
  createHttpServer,
  createToolFilter,
  closeServer,
  isMainModule,
  parseOptions,
  READ_ONLY_CAPABILITIES,
} from './cli.js';
import { ReactionaryMCPServer } from './lib/reactionary-mcp-server.js';
import { discoverReactionaryMCPTools } from './lib/tool-discovery.js';

class TestCapability extends BaseCapability {
  constructor(private readonly resourceName: string) {
    super(new MemoryCache(), createInitialRequestContext());
  }

  @Reactionary({
    inputSchema: z.undefined(),
    outputSchema: z.object({}),
  })
  public async run(): Promise<Result<unknown>> {
    return success({});
  }

  protected getResourceName(): string {
    return this.resourceName;
  }
}

describe('parseOptions', () => {
  it('rejects port strings that contain non-digits', () => {
    expect(() => parseOptions(['--port', '3000oops'], {})).toThrow(
      'Invalid port: 3000oops',
    );
  });

  it('accepts valid CLI port strings', () => {
    expect(parseOptions(['--port', '3000'], {}).port).toBe(3000);
  });

  it('defaults to loopback hosts and origins only', () => {
    const options = parseOptions([], {});

    expect(options.host).toBe('127.0.0.1');
    expect(options.allowedHosts).toEqual(['localhost', '127.0.0.1', '[::1]']);
    expect(options.allowedOrigins).toEqual(options.allowedHosts);
    expect(options.authToken).toBeUndefined();
  });

  it('defaults to the read-only tool surface', () => {
    expect(parseOptions([], {}).capabilities).toEqual(READ_ONLY_CAPABILITIES);
    expect(READ_ONLY_CAPABILITIES).not.toContain('cart');
    expect(READ_ONLY_CAPABILITIES).not.toContain('checkout');
    expect(READ_ONLY_CAPABILITIES).not.toContain('identity');
  });

  it('exposes every capability when mutating tools are enabled', () => {
    expect(
      parseOptions(['--enable-mutating-tools'], {}).capabilities,
    ).toBeUndefined();
    expect(
      parseOptions([], { MCP_ENABLE_MUTATING_TOOLS: 'true' }).capabilities,
    ).toBeUndefined();
  });

  it('exposes an explicit capability list', () => {
    expect(
      parseOptions(['--capabilities', 'product, cart'], {}).capabilities,
    ).toEqual(['product', 'cart']);
    expect(() =>
      parseOptions(['--capabilities', 'cart', '--enable-mutating-tools'], {}),
    ).toThrow('not both');
  });

  it('reads allowed hosts and origins from flags or the environment', () => {
    const options = parseOptions(['--allowed-hosts', 'a.example,b.example'], {
      MCP_ALLOWED_ORIGINS: 'app.example',
    });

    expect(options.allowedHosts).toEqual(['a.example', 'b.example']);
    expect(options.allowedOrigins).toEqual(['app.example']);
  });

  it('refuses a non-loopback host without authentication', () => {
    expect(() => parseOptions(['--host', '0.0.0.0'], {})).toThrow(
      'Refusing to listen on non-loopback host 0.0.0.0 without authentication',
    );
    expect(() => parseOptions([], { MCP_HOST: '192.168.1.10' })).toThrow(
      'without authentication',
    );
  });

  it('allows a non-loopback host with a bearer token or an explicit override', () => {
    expect(
      parseOptions(['--host', '192.168.1.10'], { MCP_AUTH_TOKEN: 'secret' })
        .allowedHosts,
    ).toContain('192.168.1.10');
    expect(
      parseOptions(['--host', '0.0.0.0', '--allow-insecure-remote'], {}).host,
    ).toBe('0.0.0.0');
  });

  it('allows loopback hosts without authentication', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1', '127.0.0.2']) {
      expect(parseOptions(['--host', host], {}).host).toBe(host);
    }
  });
});

describe('parseOptions argument syntax', () => {
  it('keeps "=" characters inside an inline value', () => {
    expect(parseOptions(['--path=/a=b'], {}).path).toBe('/a=b');
    expect(
      parseOptions(['--allowed-hosts=a.example,b=c'], {}).allowedHosts,
    ).toEqual(['a.example', 'b=c']);
  });

  it('accepts inline and separate values alike', () => {
    expect(parseOptions(['--port=4000'], {}).port).toBe(4000);
    expect(parseOptions(['--port', '4000'], {}).port).toBe(4000);
    expect(
      parseOptions(['--enable-mutating-tools=true'], {}).capabilities,
    ).toBe(undefined);
  });

  it('rejects unknown flags instead of ignoring them', () => {
    expect(() => parseOptions(['--prot', '3000'], {})).toThrow(
      'Unknown argument: --prot',
    );
    expect(() => parseOptions(['--bogus=1'], {})).toThrow(
      'Unknown argument: --bogus=1',
    );
  });

  it('rejects a value flag that has no value', () => {
    expect(() => parseOptions(['--path'], {})).toThrow(
      'Missing value for argument: --path',
    );
    expect(() => parseOptions(['--path', '--port', '1'], {})).toThrow(
      'Missing value for argument: --path',
    );
  });
});

describe('closeServer', () => {
  it('resolves although a client still holds a response stream open', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(': open\n\n');
    });
    const port = await listen(server);

    await new Promise<void>((resolve, reject) => {
      const request = httpRequest(
        { host: '127.0.0.1', port, path: '/' },
        (response) => {
          response.resume();
          resolve();
        },
      );
      // Once the server force-closes the stream, the client sees "socket hang up", which is not what is under test.
      request.on('error', reject);
      request.end();
    });

    await expect(closeServer(server)).resolves.toBeUndefined();
  });

  it('rejects when the server is not running', async () => {
    await expect(closeServer(createServer())).rejects.toThrow();
  });
});

describe('isMainModule', () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
    directory = undefined;
  });

  it('matches the module when started through a symlink, as the package bin is', () => {
    directory = mkdtempSync(join(tmpdir(), 'reactionary-mcp-'));
    const real = join(directory, 'cli.js');
    const link = join(directory, 'reactionary-mcp');
    writeFileSync(real, '');
    symlinkSync(real, link);

    expect(isMainModule(real, pathToFileURL(real).href)).toBe(true);
    expect(isMainModule(link, pathToFileURL(real).href)).toBe(true);
  });

  it('does not match another file, a missing path or no path', () => {
    directory = mkdtempSync(join(tmpdir(), 'reactionary-mcp-'));
    const real = join(directory, 'cli.js');
    const other = join(directory, 'other.js');
    writeFileSync(real, '');
    writeFileSync(other, '');

    expect(isMainModule(other, pathToFileURL(real).href)).toBe(false);
    expect(
      isMainModule(join(directory, 'missing.js'), pathToFileURL(real).href),
    ).toBe(false);
    expect(isMainModule(undefined, pathToFileURL(real).href)).toBe(false);
  });
});

describe('createBearerTokenAuthorizer', () => {
  const authorize = createBearerTokenAuthorizer('secret');
  const requestWith = (authorization?: string): Request =>
    new Request('http://localhost/mcp', {
      headers: authorization ? { authorization } : {},
    });

  it('accepts the configured token only', () => {
    expect(authorize(requestWith('Bearer secret'))).toBe(true);
    expect(authorize(requestWith('bearer secret'))).toBe(true);
    expect(authorize(requestWith('Bearer wrong'))).toBe(false);
    expect(authorize(requestWith('secret'))).toBe(false);
    expect(authorize(requestWith())).toBe(false);
  });
});

describe('createToolFilter', () => {
  const exposedTools = (capabilities: string[] | undefined): string[] =>
    discoverReactionaryMCPTools(
      Object.fromEntries(
        [
          'product-search',
          'product',
          'price',
          'inventory',
          'category',
          'cart',
          'checkout',
          'identity',
          'order',
          'employees',
          'company',
        ].map((name) => [name, new TestCapability(name)]),
      ),
      { toolFilter: createToolFilter(capabilities) },
    ).map((tool) => tool.entrypoint.capabilityName);

  it('keeps read-only tools and drops mutating ones by default', () => {
    expect(exposedTools(READ_ONLY_CAPABILITIES)).toEqual([
      'product-search',
      'product',
      'price',
      'inventory',
      'category',
    ]);
  });

  it('does not filter when no capabilities are given', () => {
    expect(createToolFilter(undefined)).toBeUndefined();
    expect(exposedTools(undefined)).toContain('checkout');
  });

  it('exposes explicitly requested mutating capabilities', () => {
    expect(exposedTools(['cart'])).toEqual(['cart']);
  });
});

describe('createHttpServer', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
    server = undefined;
  });

  it('answers a malformed Host header with 400 instead of throwing', async () => {
    const mcp = new ReactionaryMCPServer(() => ({}), {
      allowedHostnames: ['localhost'],
    });
    server = createHttpServer(mcp.toNodeHandler(), '/mcp');
    const port = await listen(server);

    const response = await send(port, '/mcp', { host: 'bad host/\\' });

    expect(response.status).toBe(400);
    await mcp.close();
  });

  it('rejects foreign hosts and origins over HTTP and lets allowed ones through', async () => {
    const mcp = new ReactionaryMCPServer(() => ({}), {
      allowedHostnames: ['localhost'],
      allowedOriginHostnames: ['localhost'],
    });
    server = createHttpServer(mcp.toNodeHandler(), '/mcp');
    const port = await listen(server);

    expect((await send(port, '/mcp', { host: 'evil.example' })).status).toBe(
      403,
    );
    expect(
      (
        await send(port, '/mcp', {
          host: `localhost:${port}`,
          origin: 'https://evil.example',
        })
      ).status,
    ).toBe(403);
    // Past screening the MCP handler itself answers: 415, as the body has no JSON content type.
    expect(
      (await send(port, '/mcp', { host: `localhost:${port}` })).status,
    ).toBe(415);
    await mcp.close();
  });

  it('answers a malformed request target with 400', async () => {
    server = createHttpServer(async () => undefined, '/mcp');
    const port = await listen(server);

    expect((await send(port, '//', { host: 'localhost' })).status).toBe(400);
  });

  it('answers other paths with 404', async () => {
    server = createHttpServer(async () => undefined, '/mcp');
    const port = await listen(server);

    expect((await send(port, '/other', { host: 'localhost' })).status).toBe(
      404,
    );
  });
});

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server is not listening on a TCP port');
  }

  return address.port;
}

function send(
  port: number,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { host: '127.0.0.1', port, path, method: 'POST', headers },
      (response) => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode ?? 0 }));
      },
    );
    request.on('error', reject);
    request.end('{}');
  });
}
