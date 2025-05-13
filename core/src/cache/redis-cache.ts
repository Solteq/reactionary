import { Redis } from '@upstash/redis';

export class RedisCache {
  protected redis = Redis.fromEnv();

  get(key: string): Promise<unknown | null> {
    return this.redis.get(key);
  }

  put(key: string, value: unknown, expiryInSeconds = 0): void {
    this.redis.set(key, value, { ex: expiryInSeconds });
  }
}
