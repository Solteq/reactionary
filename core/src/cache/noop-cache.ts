import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type z from 'zod';

/**
 * No-op cache implementation that never stores or returns data.
 * Useful for testing or when caching should be disabled.
 */
export class NoOpCache implements Cache {
  protected meter = getReactionaryCacheMeter();
  public async get<T>(_key: string, _schema: z.ZodType<T>): Promise<T | null> {
    this.meter.misses.add(1, {
      'labels.cache_type': 'noop',
    });
    return null;
  }

  public async put(_key: string, _value: unknown, options: CacheEntryOptions): Promise<void> {
    this.meter.items.record(0, {
      'labels.cache_type': 'noop',
    });
    return;
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    this.meter.items.record(0, {
      'labels.cache_type': 'noop',
    });
    return;
  }

  public async clear(): Promise<void> {
    this.meter.items.record(0, {
      'labels.cache_type': 'noop',
    });
    return;
  }
}
