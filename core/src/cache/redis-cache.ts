import { Redis } from '@upstash/redis';
import { CachingStrategy } from './caching-strategy';
import { BaseProvider } from '../providers/base.provider';
import { BaseQuery } from '../schemas/queries/base.query';
import { Session } from '../schemas/session.schema';
import { BaseModel } from '../schemas/models/base.model';
import { BaseMutation } from '../schemas/mutations/base.mutation';
import z from 'zod';

export class RedisCache {
  protected strategy: CachingStrategy;
  protected redis: Redis;

  constructor(strategy: CachingStrategy) {
    this.strategy = strategy;
    this.redis = Redis.fromEnv();
  }

  public async get<T extends BaseModel>(query: BaseQuery, session: Session, schema: z.ZodType<T>, provider: BaseProvider): Promise<T | null> {
    let result = null;
    
    const cacheInformation = this.strategy.get(query, session, provider);
    
    if (cacheInformation.canCache && cacheInformation.key) {
      const unvalidated = await this.redis.get(cacheInformation.key);
      const parsed = schema.safeParse(unvalidated);

      if (parsed.success) {
        result = parsed.data;
      }
    }
    
    return result;
  }

  public async put(query: BaseQuery, session: Session, value: unknown, provider: BaseProvider): Promise<void> {
    const cacheInformation = this.strategy.get(query, session, provider);

    if (cacheInformation.canCache && cacheInformation.key) {
      await this.redis.set(cacheInformation.key, value, { ex: cacheInformation.cacheDurationInSeconds });
    }
  }

  public async invalidate(mutation: BaseMutation, session: Session, provider: BaseProvider): Promise<void> {
    const keysToInvalidate = this.strategy.getInvalidationKeys(mutation, session, provider);
    
    for (const key of keysToInvalidate) {
      if (key.includes('*')) {
        // Handle wildcard patterns
        const pattern = key;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        // Delete specific key
        await this.redis.del(key);
      }
    }
  }

  public async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } else {
      // Clear all cache entries for this strategy's provider
      const allKeys = await this.redis.keys('*');
      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
      }
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
