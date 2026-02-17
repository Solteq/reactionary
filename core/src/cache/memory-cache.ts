import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import { error, NotFoundErrorSchema, success, type NotFoundError } from '../schemas/index.js';
import type { BaseModel } from '../schemas/models/index.js';
import type { Result } from '../schemas/result.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type * as z from 'zod';


/**
 * Memory version of the cache. Primarily useful for local development.
 * This is NOT suited for production use.
 */
export class MemoryCache implements Cache {
  protected entries = new Array<{ key: string; value: unknown, options: CacheEntryOptions }>();
  protected meter = getReactionaryCacheMeter();


  public async get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    const c = this.entries.find((x) => x.key === key);

    if (!c) {
      this.meter.misses.add(1, {
        'labels.cache_type': 'memory',
      });
      
      return null;
    }

    const parsed = schema.parse(c.value);

    this.meter.hits.add(1, {
      'labels.cache_type': 'memory',
    });

    return parsed;
  }

  public async put(
    key: string,
    value: Result<unknown>,
    options: CacheEntryOptions
  ): Promise<void> {
    this.entries.push({
        key,
        value,
        options
    });

    this.meter.items.record(this.entries.length, {
      'labels.cache_type': 'memory',
    });

    return;
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    let index = 0;
    for (const entry of this.entries) {
      for (const entryDependency of entry.options.dependencyIds) {
        if (dependencyIds.indexOf(entryDependency) > -1) {
          this.entries.splice(index, 1);
        }
      }

      index++;
    }

    this.meter.items.record(this.entries.length, {
      'labels.cache_type': 'memory',
    });


  }

  public async clear(): Promise<void> {
    this.entries = [];

    this.meter.items.record(this.entries.length, {
      'labels.cache_type': 'memory',
    });


  }
}
