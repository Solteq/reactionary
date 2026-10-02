import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import type { BaseModel } from '../schemas/models/index.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type * as z from 'zod';


interface MemoryCacheEntry {
  value: unknown;
  options: CacheEntryOptions;
  expiresAt: number;
}

/**
 * Memory version of the cache. Primarily useful for local development.
 * This is NOT suited for production use.
 */
export class MemoryCache implements Cache {
  protected entries = new Map<string, MemoryCacheEntry>();
  protected meter = getReactionaryCacheMeter();


  public async get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    const entry = this.entries.get(key);

    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        this.entries.delete(key);
      }

      this.meter.misses.add(1, {
        'labels.cache_type': 'memory',
      });

      return null;
    }

    const parsed = schema.parse(entry.value);

    this.meter.hits.add(1, {
      'labels.cache_type': 'memory',
    });

    return parsed;
  }

  public async put(
    key: string,
    value: unknown,
    options: CacheEntryOptions
  ): Promise<void> {
    this.entries.set(key, {
      value,
      options,
      expiresAt: Date.now() + options.ttlSeconds * 1000,
    });

    this.meter.items.record(this.entries.size, {
      'labels.cache_type': 'memory',
    });

    return;
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    for (const [key, entry] of this.entries) {
      if (entry.options.dependencyIds.some((dependencyId) => dependencyIds.includes(dependencyId))) {
        this.entries.delete(key);
      }
    }

    this.meter.items.record(this.entries.size, {
      'labels.cache_type': 'memory',
    });
  }

  public async clear(): Promise<void> {
    this.entries = new Map();

    this.meter.items.record(this.entries.size, {
      'labels.cache_type': 'memory',
    });
  }
}
