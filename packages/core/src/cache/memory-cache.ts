import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import type { BaseModel } from '../schemas/models/index.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';
import type * as z from 'zod';

/**
 * The number of entries a MemoryCache holds when no limit is configured.
 */
export const DEFAULT_MEMORY_CACHE_MAX_ENTRIES = 10_000;

export interface MemoryCacheOptions {
  /**
   * The maximum number of entries kept. When a put would exceed it, expired
   * entries are dropped first, then the least recently used entries.
   * Must be a positive integer, or Infinity to disable the limit.
   * Defaults to DEFAULT_MEMORY_CACHE_MAX_ENTRIES.
   */
  maxEntries?: number;
}

interface MemoryCacheEntry {
  value: unknown;
  options: CacheEntryOptions;
  expiresAt: number;
}

/**
 * Memory version of the cache. Primarily useful for local development.
 * This is NOT suited for production use.
 *
 * The cache holds at most `maxEntries` entries (10,000 by default) and evicts
 * the least recently used entry when it is full. A read or a write counts as
 * use. `entries` is kept in recency order, least recently used first.
 *
 * Expired entries are removed when they are read, when a put finds the cache
 * over its limit, and never otherwise, so a cache below its limit may still
 * hold expired entries. The sweep on put scans all entries, but only runs when
 * at least one entry is known to have expired.
 */
export class MemoryCache implements Cache {
  protected entries = new Map<string, MemoryCacheEntry>();
  protected meter = getReactionaryCacheMeter();
  protected maxEntries: number;

  /**
   * A lower bound for the earliest expiresAt of the entries. Entries that are
   * removed by other means leave it too low, which costs one needless sweep.
   * A subclass that adds to `entries` directly must lower it as well, or the
   * entry is not found by the sweep on put.
   */
  protected earliestExpiresAt = Infinity;

  constructor(options: MemoryCacheOptions = {}) {
    const maxEntries = options.maxEntries ?? DEFAULT_MEMORY_CACHE_MAX_ENTRIES;

    if (maxEntries !== Infinity && !(Number.isInteger(maxEntries) && maxEntries > 0)) {
      throw new RangeError(
        `MemoryCache maxEntries must be a positive integer or Infinity, got ${maxEntries}`
      );
    }

    this.maxEntries = maxEntries;
  }

  public async get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    const entry = this.entries.get(key);

    if (!entry) {
      return this.recordMiss();
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return this.recordMiss();
    }

    const parsed = schema.safeParse(entry.value);

    if (!parsed.success) {
      this.entries.delete(key);
      return this.recordMiss();
    }

    // Re-insert so the entry becomes the most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);

    this.meter.hits.add(1, {
      'labels.cache_type': 'memory',
    });

    return parsed.data;
  }

  public async put(
    key: string,
    value: unknown,
    options: CacheEntryOptions
  ): Promise<void> {
    const expiresAt = Date.now() + options.ttlSeconds * 1000;

    // Delete first, so an overwritten key moves to the most recently used
    // position and does not count as growth.
    this.entries.delete(key);
    this.entries.set(key, { value, options, expiresAt });
    this.earliestExpiresAt = Math.min(this.earliestExpiresAt, expiresAt);

    if (this.entries.size > this.maxEntries) {
      this.evict();
    }

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
    this.earliestExpiresAt = Infinity;

    this.meter.items.record(this.entries.size, {
      'labels.cache_type': 'memory',
    });
  }

  /**
   * Brings the cache back within maxEntries. Expired entries go first, then
   * the least recently used ones.
   */
  protected evict(): void {
    this.removeExpired();

    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) {
        break;
      }

      this.entries.delete(key);
    }
  }

  /**
   * Removes all expired entries. This scans every entry, so it is skipped
   * when none is known to have expired. Also recomputes earliestExpiresAt.
   */
  protected removeExpired(): void {
    const now = Date.now();

    if (this.earliestExpiresAt > now) {
      return;
    }

    let earliestExpiresAt = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      } else {
        earliestExpiresAt = Math.min(earliestExpiresAt, entry.expiresAt);
      }
    }

    this.earliestExpiresAt = earliestExpiresAt;
  }

  protected recordMiss(): null {
    this.meter.misses.add(1, {
      'labels.cache_type': 'memory',
    });

    return null;
  }
}
