import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type z from 'zod';

/**
 * No-op cache implementation that never stores or returns data.
 * Useful for testing or when caching should be disabled.
 */
export class NoOpCache implements Cache {
  public async get<T>(_key: string, _schema: z.ZodType<T>): Promise<T | null> {
    return null;
  }

  public async put(_key: string, _value: unknown, options: CacheEntryOptions): Promise<void> {
    return;
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    return;
  }

  public async clear(): Promise<void> {
    return;
  }
}