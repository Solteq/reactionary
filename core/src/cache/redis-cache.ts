import { Redis } from '@upstash/redis';
import { CachingStrategy } from './caching-strategy';
import { BaseQuery } from '../schemas/queries/base.query';
import { Session } from '../schemas/session.schema';
import { BaseModel } from '../schemas/models/base.model';
import z from 'zod';

export class RedisCache {
  protected strategy: CachingStrategy;
  protected redis: Redis;

  constructor(strategy: CachingStrategy) {
    this.strategy = strategy;
    this.redis = Redis.fromEnv();
  }

  public async get<T extends BaseModel>(query: BaseQuery, session: Session, schema: z.ZodType<T>): Promise<T | null> {
    let result = null;
    
    const cacheInformation = this.strategy.get(query, session);
    
    if (cacheInformation.canCache && cacheInformation.key) {
      const unvalidated = await this.redis.get(cacheInformation.key);
      const parsed = schema.safeParse(unvalidated);

      if (parsed.success) {
        result = parsed.data;
      }
    }
    
    return result;
  }

  public put(query: BaseQuery, session: Session, value: unknown): void {
    const cacheInformation = this.strategy.get(query, session);

    if (cacheInformation.canCache && cacheInformation.key) {
      this.redis.set(cacheInformation.key, value, { ex: cacheInformation.cacheDurationInSeconds });
    }
  }
}
