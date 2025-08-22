import { Redis } from '@upstash/redis';
import { Cache } from './cache.interface';
import z from 'zod';

export class RedisCache implements Cache {
  protected redis: Redis;

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
      return parsed.data;
    }
    
    return null;
  }

  public async put(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!key) {
      return;
    }

    const options = ttlSeconds ? { ex: ttlSeconds } : undefined;
    await this.redis.set(key, value, options);
  }

  public async del(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    for (const key of keyArray) {
      if (key.includes('*')) {
        // Handle wildcard patterns
        const matchingKeys = await this.redis.keys(key);
        if (matchingKeys.length > 0) {
          await this.redis.del(...matchingKeys);
        }
      } else {
        // Delete specific key
        await this.redis.del(key);
      }
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  public async clear(pattern?: string): Promise<void> {
    const searchPattern = pattern || '*';
    const keys = await this.redis.keys(searchPattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  public async getStats(): Promise<{ hits: number; misses: number; size: number }> {
    // Basic cache statistics (could be enhanced with actual Redis metrics)
    const keys = await this.redis.keys('*');
    return {
      hits: 0, // Would need to track this separately
      misses: 0, // Would need to track this separately  
      size: keys.length
    };
  }
}
