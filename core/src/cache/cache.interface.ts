import type { z } from 'zod';
import type { BaseModel } from '../schemas/models/index.js';
import type { NotFoundError, Result } from '../schemas/index.js';

export interface CacheEntryOptions {
  ttlSeconds: number;
  dependencyIds: Array<string>;
}

/**
 * Generic cache interface that can be implemented by different cache backends
 * (Redis, memory, file-based, etc.)
 */
export interface Cache {
  /**
   * Retrieves a value from cache and validates it against the provided schema
   */
  get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null>;

  /**
   * Stores a value in cache with optional expiration time
   */
  put(key: string, value: unknown, options: CacheEntryOptions): Promise<void>;

  /**
   * Removes entries from the cache based on a set of dependency
   * ids
   */
  invalidate(dependencyIds: Array<string>): Promise<void>;

  /**
   * Removes all entries from cache, wiping it completely
   */
  clear(): Promise<void>;
}