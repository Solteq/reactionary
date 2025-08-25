import { Cache } from './cache.interface';
import z from 'zod';

/**
 * No-op cache implementation that never stores or returns data.
 * Useful for testing or when caching should be disabled.
 */
export class NoOpCache implements Cache {
  public async get<T>(_key: string, _schema: z.ZodType<T>): Promise<T | null> {
    // Always return null - never a cache hit
    return null;
  }

  public async put(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {
    // No-op - silently ignore cache write requests
    return;
  }

  public async del(_keys: string | string[]): Promise<void> {
    // No-op - silently ignore delete requests
    return;
  }

  public async keys(_pattern: string): Promise<string[]> {
    // Always return empty array
    return [];
  }

  public async clear(_pattern?: string): Promise<void> {
    // No-op - silently ignore clear requests
    return;
  }

  public async getStats(): Promise<{ hits: number; misses: number; size: number }> {
    // Always return zeros
    return {
      hits: 0,
      misses: 0,
      size: 0
    };
  }
}