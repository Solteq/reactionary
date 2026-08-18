import { createClient } from 'redis';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type * as z from 'zod';
import { getReactionaryCacheMeter } from '../metrics/metrics.js';

export class RedisCache implements Cache {
  protected redis: ReturnType<typeof createClient>;
  protected connectPromise?: Promise<ReturnType<typeof createClient>>;
  protected meter = getReactionaryCacheMeter();

  constructor(redisUrl = process.env['REDIS_URL']) {
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }

    this.redis = createClient({
      url: redisUrl,
    });

    this.redis.on('error', (err: any) => {
      console.error('Redis error', err);
    });
  }

  protected async client(): Promise<ReturnType<typeof createClient>> {
    if (!this.connectPromise) {
      this.connectPromise = this.redis.connect();
    }

    return this.connectPromise;
  }

  public async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    if (!key) {
      return null;
    }

    const redis = await this.client();

    const serialized = await redis.get(key);

    if (serialized === null) {
      return null;
    }

    let unvalidated: unknown;

    try {
      unvalidated = JSON.parse(serialized);
    } catch {
      return null;
    }

    const parsed = schema.safeParse(unvalidated);

    if (parsed.success) {
      this.meter.hits.add(1, {
        'labels.cache_type': 'redis',
      });

      return parsed.data;
    }

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

    const redis = await this.client();
    const serialized = JSON.stringify(value);

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
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    const redis = await this.client();

    for (const id of dependencyIds) {
      const depKey = `dep:${id}`;
      const keys = await redis.sMembers(depKey);

      if (keys.length > 0) {
        await redis.del(keys);
      }

      await redis.del(depKey);
    }

    this.meter.items.record(await redis.dbSize(), {
      'labels.cache_type': 'redis',
    });
  }

  public async clear(): Promise<void> {
    const redis = await this.client();

    this.meter.items.record(await redis.dbSize(), {
      'labels.cache_type': 'redis',
    });

    await redis.flushDb();
  }

  public async close(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }
}
