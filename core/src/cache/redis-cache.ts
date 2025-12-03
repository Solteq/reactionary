import { Redis } from '@upstash/redis';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type z from 'zod';
import { getReactionaryCacheMeter } from '../metrics/metrics.js';

export class RedisCache implements Cache {
  protected redis: Redis;
  protected meter = getReactionaryCacheMeter();


  constructor() {
    this.redis = Redis.fromEnv();
  }

  public async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    if (!key) {
      return null;
    }

    const unvalidated = await this.redis.get(key);
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
    options: CacheEntryOptions
  ): Promise<void> {
    if (!key) {
      return;
    }

    const serialized = JSON.stringify(value);
    const multi = this.redis.multi();

    multi.set(key, serialized, { ex: options.ttlSeconds });

    for (const depId of options.dependencyIds) {
      multi.sadd(`dep:${depId}`, key);
    }

    this.meter.items.record(await this.redis.dbsize(), {
      'labels.cache_type': 'redis',
    });

    await multi.exec();
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    for (const id of dependencyIds) {
      const depKey = `dep:${id}`;
      const keys = await this.redis.smembers(depKey);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      await this.redis.del(depKey);
    }

    this.meter.items.record(await this.redis.dbsize(), {
      'labels.cache_type': 'redis',
    });

  }

  public async clear(): Promise<void> {
    this.meter.items.record(await this.redis.dbsize(), {
      'labels.cache_type': 'redis',
    });
    // Not sure about supporting this on Redis.
  }
}
