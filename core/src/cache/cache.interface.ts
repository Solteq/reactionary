import { z } from 'zod';

/**
 * Generic cache interface that can be implemented by different cache backends
 * (Redis, memory, file-based, etc.)
 */
export interface Cache {
  /**
   * Retrieves a value from cache and validates it against the provided schema
   */
  get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;

  /**
   * Stores a value in cache with optional expiration time
   */
  put(key: string, value: unknown, ttlSeconds?: number): Promise<void>;

  /**
   * Removes one or more keys from cache
   * Supports wildcard patterns (implementation dependent)
   */
  del(keys: string | string[]): Promise<void>;

  /**
   * Finds all keys matching a pattern (implementation dependent)
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Clears all cache entries or entries matching a pattern
   */
  clear(pattern?: string): Promise<void>;

  /**
   * Gets basic cache statistics (implementation dependent)
   */
  getStats(): Promise<{ hits: number; misses: number; size: number }>;
}