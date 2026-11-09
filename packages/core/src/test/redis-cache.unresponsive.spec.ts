import net from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { BaseCapability } from '../capabilities/base.capability.js';
import type { Cache } from '../cache/cache.interface.js';
import { RedisCache } from '../cache/redis-cache.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import { success, type Result } from '../index.js';

// These tests run the real node-redis client against sockets that behave like
// a broken Redis, so they need no Redis server.

const OPERATION_TIMEOUT_MS = 200;

class TestCapability extends BaseCapability {
  public calls = 0;

  constructor(cache: Cache) {
    super(cache, createInitialRequestContext());
  }

  @Reactionary({
    inputSchema: z.undefined(),
    outputSchema: z.string(),
    cache: true,
  })
  public async cachedFunction(): Promise<Result<string>> {
    this.calls++;

    return success('BACKEND');
  }

  protected getResourceName(): string {
    return 'TestCapability';
  }
}

const sockets: net.Socket[] = [];

/**
 * Starts a TCP server that answers the commands the client sends while
 * connecting with +OK, and stays silent for GET (or for everything when
 * `silent` is set).
 */
async function startServer(silent: boolean): Promise<net.Server> {
  const server = net.createServer((socket) => {
    socket.on('error', () => undefined);
    sockets.push(socket);
    socket.on('data', (chunk) => {
      if (silent) {
        return;
      }

      const commands = chunk
        .toString()
        .matchAll(/\*\d+\r\n\$\d+\r\n([A-Za-z]+)\r\n/g);

      for (const [, name] of commands) {
        if (name.toUpperCase() !== 'GET') {
          socket.write('+OK\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return server;
}

function portOf(server: net.Server): number {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server is not listening on a port');
  }

  return address.port;
}

describe('RedisCache against a Redis that does not answer', () => {
  const servers: net.Server[] = [];
  const caches: RedisCache[] = [];

  function createCache(port: number): RedisCache {
    const cache = new RedisCache(`redis://127.0.0.1:${port}`, {
      operationTimeoutMs: OPERATION_TIMEOUT_MS,
      connectTimeoutMs: 100,
    });
    caches.push(cache);

    return cache;
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all(caches.splice(0).map((cache) => cache.close()));
    sockets.splice(0).forEach((socket) => socket.destroy());
    await Promise.all(
      servers.splice(0).map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
    vi.restoreAllMocks();
  });

  async function expectCachedCallToSucceedQuickly(cache: RedisCache) {
    const capability = new TestCapability(cache);
    const startedAt = performance.now();

    const result = await capability.cachedFunction();

    const elapsed = performance.now() - startedAt;
    expect(result.success).toBe(true);
    expect(capability.calls).toBe(1);
    // The timeout plus slack for a loaded CI machine, well below a hang.
    expect(elapsed).toBeLessThan(OPERATION_TIMEOUT_MS + 1500);
  }

  it('serves a cached call from the backend when Redis is unreachable', async () => {
    const closed = await startServer(true);
    const port = portOf(closed);
    await new Promise((resolve) => closed.close(resolve));

    await expectCachedCallToSucceedQuickly(createCache(port));
  });

  it('serves a cached call from the backend when Redis accepts the connection but never answers', async () => {
    const server = await startServer(true);
    servers.push(server);

    await expectCachedCallToSucceedQuickly(createCache(portOf(server)));
  });

  it('serves a cached call from the backend when Redis freezes after connecting', async () => {
    const server = await startServer(false);
    servers.push(server);

    await expectCachedCallToSucceedQuickly(createCache(portOf(server)));
  });

  it('rejects get within the timeout instead of hanging', async () => {
    const server = await startServer(false);
    servers.push(server);
    const cache = createCache(portOf(server));

    await expect(cache.get('k', z.string())).rejects.toThrow('timed out');
  });

  it('closes the connection even though Redis never answers QUIT', async () => {
    const server = await startServer(false);
    servers.push(server);
    const cache = createCache(portOf(server));
    await cache.get('k', z.string()).catch(() => undefined);

    await cache.close();

    await vi.waitFor(() => {
      expect(sockets.every((socket) => socket.destroyed)).toBe(true);
    });
  });
});
