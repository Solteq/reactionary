import type { BaseModel } from '../schemas/models';
import type { Cache, CacheEntryOptions } from './cache.interface';
import type z from 'zod';

/**
 * Memory version of the cache. Primarily useful for local development.
 * This is NOT suited for production use.
 */
export class MemoryCache implements Cache {
  protected entries = new Array<{ key: string; value: unknown, options: CacheEntryOptions }>();

  public async get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    const c = this.entries.find((x) => x.key === key);

    if (!c) {
      return null;
    }

    const parsed = schema.parse(c.value);

    parsed.meta.cache.hit = true;

    return parsed;
  }

  public async put(
    key: string,
    value: unknown,
    options: CacheEntryOptions
  ): Promise<void> {
    this.entries.push({
        key,
        value,
        options
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
  }

  public async clear(): Promise<void> {
    this.entries = [];
  }
}
