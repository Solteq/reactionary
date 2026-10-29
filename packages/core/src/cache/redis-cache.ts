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

  /**
   * Prepended to every key this cache writes, and the only keys `clear()`
   * removes, so the cache can share a Redis database with other data.
   * Defaults to `reactionary:`. Changing it makes the existing entries
   * unreachable, which for a cache only costs one round of misses; they expire
   * on their own TTL. Must not be empty.
   */
  keyPrefix?: string;

  /**
   * The minimum time, in milliseconds, between two samples of the item count
   * metric. The count is `DBSIZE` of the whole database and is sampled in the
   * background after writes, not on every write. Defaults to 30000.
   */
  itemCountIntervalMs?: number;
}

/**
 * A cache backed by Redis. Requires Redis 7.0 or later: the expiry of the
 * dependency sets uses `EXPIRE` with the `NX` and `GT` options.
 */
export class RedisCache implements Cache {
  protected redis: ReturnType<typeof createClient>;
  protected connectPromise?: Promise<ReturnType<typeof createClient>>;
  protected meter = getReactionaryCacheMeter();
  protected operationTimeoutMs: number;
  protected keyPrefix: string;
  protected itemCountIntervalMs: number;
  protected lastItemCountSampleAt = Number.NEGATIVE_INFINITY;

  constructor(
    redisUrl = process.env['REDIS_URL'],
    options: RedisCacheOptions = {},
  ) {
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }

    this.keyPrefix = options.keyPrefix ?? 'reactionary:';

    if (!this.keyPrefix) {
      throw new Error('keyPrefix must not be empty');
    }

    this.operationTimeoutMs = options.operationTimeoutMs ?? 500;
    this.itemCountIntervalMs = options.itemCountIntervalMs ?? 30_000;
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

  protected entryKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  protected dependencyKey(dependencyId: string): string {
    return `${this.keyPrefix}dep:${dependencyId}`;
  }

  /**
   * The SCAN pattern matching every key of this cache, with the glob
   * characters of the prefix escaped.
   */
  protected scanPattern(): string {
    return `${this.keyPrefix.replace(/[\\*?[\]^]/g, '\\$&')}*`;
  }

  /**
   * Records the item count metric, at most once per `itemCountIntervalMs`. The
   * count is fetched in the background so that it adds no round trip to the
   * operation that triggered it.
   */
  protected sampleItemCount(): void {
    const now = Date.now();

    if (now - this.lastItemCountSampleAt < this.itemCountIntervalMs) {
      return;
    }

    this.lastItemCountSampleAt = now;

    this.execute((redis) => redis.dbSize())
      .then((count) => {
        this.meter.items.record(count, {
          'labels.cache_type': 'redis',
        });
      })
      .catch(() => {
        // The metric is best effort. Failures of the cache itself surface in
        // the operations that matter.
      });
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

    const serialized = await this.execute((redis) => redis.get(this.entryKey(key)));

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
    const redisKey = this.entryKey(key);

    await this.execute(async (redis) => {
      const multi = redis.multi();

      multi.set(redisKey, serialized, {
        EX: options.ttlSeconds,
      });

      // A dependency set must outlive every entry it lists, or invalidating
      // by dependency would miss entries that are still cached. NX gives a new
      // set its first expiry (GT treats a set without one as infinitely long
      // and would never set it), GT only ever extends an existing one.
      for (const depId of options.dependencyIds) {
        const depKey = this.dependencyKey(depId);

        multi.sAdd(depKey, redisKey);
        multi.expire(depKey, options.ttlSeconds, 'NX');
        multi.expire(depKey, options.ttlSeconds, 'GT');
      }

      await multi.exec();
    });

    this.sampleItemCount();
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    // One timeout per round trip: invalidating many ids takes longer than a
    // single get, and should not time out as a whole on a healthy Redis.
    for (const id of dependencyIds) {
      const depKey = this.dependencyKey(id);
      const keys = await this.execute((redis) => redis.sMembers(depKey));

      await this.execute((redis) => redis.del([...keys, depKey]));
    }

    this.sampleItemCount();
  }

  /**
   * Removes every key with this cache's prefix and leaves the rest of the
   * database alone. The keys are found with SCAN and removed in batches with
   * UNLINK, so a large cache does not block Redis. The operation timeout
   * applies to each round trip, not to the whole scan. If a round trip fails
   * the operation rejects and the batches removed so far stay removed.
   */
  public async clear(): Promise<void> {
    let cursor = '0';

    do {
      const current = cursor;
      const page = await this.execute((redis) =>
        redis.scan(current, { MATCH: this.scanPattern(), COUNT: 1000 }),
      );

      if (page.keys.length > 0) {
        await this.execute((redis) => redis.unlink(page.keys));
      }

      cursor = page.cursor;
    } while (cursor !== '0');

    this.lastItemCountSampleAt = Number.NEGATIVE_INFINITY;
    this.sampleItemCount();
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
