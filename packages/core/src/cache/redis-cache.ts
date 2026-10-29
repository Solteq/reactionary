import { createClient, type RedisClientOptions } from 'redis';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type * as z from 'zod';
import { getReactionaryCacheMeter } from '../metrics/metrics.js';

export interface RedisCacheOptions {
  /**
   * The longest time, in milliseconds, that a Redis round trip of the cache
   * (a get, a put, or one step of invalidate or clear) may take, including
   * connecting to Redis. When it is exceeded the operation rejects. The cache
   * is an optimisation, so this is kept short. Defaults to 500.
   */
  operationTimeoutMs?: number;

  /**
   * The time, in milliseconds, after which a single attempt to open the socket
   * to Redis is abandoned. The client keeps retrying in the background.
   * Defaults to 1000.
   */
  connectTimeoutMs?: number;

  /**
   * Additional configuration for the underlying node-redis client. It is
   * applied over the defaults of this cache, which are `disableOfflineQueue:
   * true` (commands are rejected while the client is not connected, instead
   * of being queued until it is) and `commandsQueueMaxLength: 1000` (bounds the
   * commands left waiting for a reply by a Redis that has stopped answering;
   * it counts all commands in flight, so raise it if a healthy Redis serves
   * more concurrent commands than that). A connection to a Redis that has
   * frozen is only replaced when the socket closes. To detect it earlier set
   * `socket.socketTimeout` together with `pingInterval` (below it) and a
   * `socket.reconnectStrategy`, because the default strategy does not
   * reconnect after a socket timeout. `url` is always taken from the
   * constructor.
   */
  clientOptions?: RedisClientOptions;
}

export class RedisCache implements Cache {
  protected redis: ReturnType<typeof createClient>;
  protected connectPromise?: Promise<ReturnType<typeof createClient>>;
  protected meter = getReactionaryCacheMeter();
  protected operationTimeoutMs: number;

  constructor(
    redisUrl = process.env['REDIS_URL'],
    options: RedisCacheOptions = {},
  ) {
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }

    this.operationTimeoutMs = options.operationTimeoutMs ?? 500;
    this.redis = this.createRedisClient(redisUrl, options);

    this.redis.on('error', (err: unknown) => {
      console.error('Redis error', err);
    });
  }

  /**
   * Creates the node-redis client. Called from the constructor, so an override
   * cannot rely on fields its own subclass initialises.
   */
  protected createRedisClient(
    redisUrl: string,
    options: RedisCacheOptions,
  ): ReturnType<typeof createClient> {
    const clientOptions = options.clientOptions ?? {};

    return createClient({
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      ...clientOptions,
      socket: {
        connectTimeout: options.connectTimeoutMs ?? 1000,
        ...clientOptions.socket,
      },
      url: redisUrl,
    });
  }

  /**
   * Runs an operation against the connected client and rejects if it has not
   * finished within the operation timeout. node-redis only applies a command
   * timeout while the command is still waiting to be written, so a Redis that
   * accepts the connection but stops answering would otherwise never settle.
   */
  protected async execute<T>(
    operation: (redis: ReturnType<typeof createClient>) => Promise<T>,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(`Redis operation timed out after ${this.operationTimeoutMs}ms`),
        );
      }, this.operationTimeoutMs);
    });

    try {
      return await Promise.race([
        this.client().then(operation),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  protected async client(): Promise<ReturnType<typeof createClient>> {
    if (!this.connectPromise) {
      // A rejected connect is not kept, so that a later call can try again.
      this.connectPromise = this.redis.connect().catch((err: unknown) => {
        this.connectPromise = undefined;
        throw err;
      });
    }

    return this.connectPromise;
  }

  protected recordMiss(): void {
    this.meter.misses.add(1, {
      'labels.cache_type': 'redis',
    });
  }

  public async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    if (!key) {
      return null;
    }

    const serialized = await this.execute((redis) => redis.get(key));

    if (serialized === null) {
      this.recordMiss();

      return null;
    }

    let unvalidated: unknown;

    try {
      unvalidated = JSON.parse(serialized);
    } catch {
      this.recordMiss();

      return null;
    }

    const parsed = schema.safeParse(unvalidated);

    if (parsed.success) {
      this.meter.hits.add(1, {
        'labels.cache_type': 'redis',
      });

      return parsed.data;
    }

    this.recordMiss();

    return null;
  }

  public async put(
    key: string,
    value: unknown,
    options: CacheEntryOptions,
  ): Promise<void> {
    if (!key) {
      return;
    }

    const serialized = JSON.stringify(value);

    await this.execute(async (redis) => {
      const multi = redis.multi();

      multi.set(key, serialized, {
        EX: options.ttlSeconds,
      });

      for (const depId of options.dependencyIds) {
        multi.sAdd(`dep:${depId}`, key);
      }

      await multi.exec();

      this.meter.items.record(await redis.dbSize(), {
        'labels.cache_type': 'redis',
      });
    });
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    // One timeout per round trip: invalidating many ids takes longer than a
    // single get, and should not time out as a whole on a healthy Redis.
    for (const id of dependencyIds) {
      const depKey = `dep:${id}`;
      const keys = await this.execute((redis) => redis.sMembers(depKey));

      await this.execute((redis) => redis.del([...keys, depKey]));
    }

    await this.execute(async (redis) => {
      this.meter.items.record(await redis.dbSize(), {
        'labels.cache_type': 'redis',
      });
    });
  }

  public async clear(): Promise<void> {
    await this.execute(async (redis) => {
      this.meter.items.record(await redis.dbSize(), {
        'labels.cache_type': 'redis',
      });

      await redis.flushDb();
    });
  }

  public async close(): Promise<void> {
    // QUIT is not used: it waits for the commands ahead of it, so against a
    // Redis that is unreachable or frozen it would never finish, and once it
    // has been sent the client can no longer be destroyed. Commands still in
    // flight are dropped, which only costs cache entries.
    if (this.redis.isOpen) {
      this.redis.destroy();
    }
  }
}
