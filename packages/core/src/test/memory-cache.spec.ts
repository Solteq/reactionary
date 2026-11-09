import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import {
  DEFAULT_MEMORY_CACHE_MAX_ENTRIES,
  MemoryCache,
} from '../cache/memory-cache.js';
import type { CacheEntryOptions } from '../cache/cache.interface.js';

const ItemSchema = z.looseObject({
  name: z.string(),
});

const options: CacheEntryOptions = { ttlSeconds: 60, dependencyIds: [] };

class InspectableMemoryCache extends MemoryCache {
  public keys(): Array<string> {
    return [...this.entries.keys()];
  }

  public get limit(): number {
    return this.maxEntries;
  }
}

async function has(cache: MemoryCache, key: string): Promise<boolean> {
  return (await cache.get(key, ItemSchema)) !== null;
}

describe('MemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('options', () => {
    it('has a finite default limit', () => {
      const cache = new InspectableMemoryCache();

      expect(cache.limit).toBe(DEFAULT_MEMORY_CACHE_MAX_ENTRIES);
      expect(Number.isFinite(cache.limit)).toBe(true);
    });

    it('uses the default limit when maxEntries is undefined', () => {
      expect(new InspectableMemoryCache({}).limit).toBe(DEFAULT_MEMORY_CACHE_MAX_ENTRIES);
      expect(new InspectableMemoryCache({ maxEntries: undefined }).limit).toBe(
        DEFAULT_MEMORY_CACHE_MAX_ENTRIES
      );
    });

    it('accepts a positive integer and Infinity', () => {
      expect(new InspectableMemoryCache({ maxEntries: 1 }).limit).toBe(1);
      expect(new InspectableMemoryCache({ maxEntries: 500 }).limit).toBe(500);
      expect(new InspectableMemoryCache({ maxEntries: Infinity }).limit).toBe(Infinity);
    });

    it.each([0, -1, 1.5, NaN, -Infinity])('rejects maxEntries %s', (maxEntries) => {
      expect(() => new MemoryCache({ maxEntries })).toThrow(
        /maxEntries must be a positive integer or Infinity/
      );
    });
  });

  describe('eviction', () => {
    it('evicts the least recently used entry when full', async () => {
      const cache = new MemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);
      await cache.put('c', { name: 'c' }, options);

      expect(await has(cache, 'a')).toBe(false);
      expect(await has(cache, 'b')).toBe(true);
      expect(await has(cache, 'c')).toBe(true);
    });

    it('treats a hit as use', async () => {
      const cache = new MemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);
      expect(await has(cache, 'a')).toBe(true);
      await cache.put('c', { name: 'c' }, options);

      expect(await has(cache, 'a')).toBe(true);
      expect(await has(cache, 'b')).toBe(false);
      expect(await has(cache, 'c')).toBe(true);
    });

    it('does not evict others when a key is overwritten', async () => {
      const cache = new InspectableMemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);
      await cache.put('a', { name: 'a2' }, options);
      await cache.put('b', { name: 'b2' }, options);

      expect(cache.keys()).toEqual(['a', 'b']);
      expect((await cache.get('a', ItemSchema))?.name).toBe('a2');
      expect((await cache.get('b', ItemSchema))?.name).toBe('b2');
    });

    it('treats an overwrite as use', async () => {
      const cache = new MemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);
      await cache.put('a', { name: 'a2' }, options);
      await cache.put('c', { name: 'c' }, options);

      expect(await has(cache, 'a')).toBe(true);
      expect(await has(cache, 'b')).toBe(false);
    });

    it('drops expired entries before evicting live ones', async () => {
      const cache = new MemoryCache({ maxEntries: 3 });

      await cache.put('live-old', { name: 'live-old' }, options);
      await cache.put('short', { name: 'short' }, { ttlSeconds: 1, dependencyIds: [] });
      await cache.put('live-new', { name: 'live-new' }, options);

      vi.advanceTimersByTime(2000);
      await cache.put('extra', { name: 'extra' }, options);

      expect(await has(cache, 'live-old')).toBe(true);
      expect(await has(cache, 'live-new')).toBe(true);
      expect(await has(cache, 'extra')).toBe(true);
      expect(await has(cache, 'short')).toBe(false);
    });

    it('keeps expired entries when the cache is not full', async () => {
      const cache = new InspectableMemoryCache({ maxEntries: 3 });

      await cache.put('short', { name: 'short' }, { ttlSeconds: 1, dependencyIds: [] });
      vi.advanceTimersByTime(2000);
      await cache.put('a', { name: 'a' }, options);

      expect(cache.keys()).toEqual(['short', 'a']);
    });

    it('evicts live entries once the expired ones are gone', async () => {
      const cache = new MemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('short', { name: 'short' }, { ttlSeconds: 1, dependencyIds: [] });
      vi.advanceTimersByTime(2000);
      await cache.put('b', { name: 'b' }, options);
      await cache.put('c', { name: 'c' }, options);

      expect(await has(cache, 'a')).toBe(false);
      expect(await has(cache, 'b')).toBe(true);
      expect(await has(cache, 'c')).toBe(true);
    });

    it('sweeps expired entries again in later rounds', async () => {
      const cache = new MemoryCache({ maxEntries: 3 });

      await cache.put('first', { name: 'first' }, { ttlSeconds: 10, dependencyIds: [] });
      await cache.put('old', { name: 'old' }, options);
      await cache.put('middle', { name: 'middle' }, { ttlSeconds: 30, dependencyIds: [] });
      vi.advanceTimersByTime(11_000);
      await cache.put('d', { name: 'd' }, options);

      // The first sweep must leave a correct bound for the second one.
      vi.advanceTimersByTime(20_000);
      await cache.put('e', { name: 'e' }, options);

      expect(await has(cache, 'middle')).toBe(false);
      expect(await has(cache, 'old')).toBe(true);
      expect(await has(cache, 'd')).toBe(true);
      expect(await has(cache, 'e')).toBe(true);
    });

    it('never exceeds the limit under many puts', async () => {
      const cache = new InspectableMemoryCache({ maxEntries: 50 });

      for (let i = 0; i < 1000; i++) {
        await cache.put(`key-${i}`, { name: `${i}` }, options);
        expect(cache.keys().length).toBeLessThanOrEqual(50);
      }

      expect(cache.keys().length).toBe(50);
      expect(cache.keys()[0]).toBe('key-950');
      expect(cache.keys()[49]).toBe('key-999');
    });

    it('holds a single entry with maxEntries 1', async () => {
      const cache = new MemoryCache({ maxEntries: 1 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);

      expect(await has(cache, 'a')).toBe(false);
      expect(await has(cache, 'b')).toBe(true);
    });

    it('does not evict with an unlimited cache', async () => {
      const cache = new InspectableMemoryCache({ maxEntries: Infinity });

      for (let i = 0; i < 20_000; i++) {
        await cache.put(`key-${i}`, { name: `${i}` }, options);
      }

      expect(cache.keys().length).toBe(20_000);
      expect(await has(cache, 'key-0')).toBe(true);
    });
  });

  describe('get', () => {
    it('returns null for a missing key', async () => {
      const cache = new MemoryCache();

      expect(await cache.get('missing', ItemSchema)).toBeNull();
    });

    it('returns null for an expired entry and removes it', async () => {
      const cache = new InspectableMemoryCache();

      await cache.put('a', { name: 'a' }, { ttlSeconds: 1, dependencyIds: [] });
      vi.advanceTimersByTime(1000);

      expect(await cache.get('a', ItemSchema)).toBeNull();
      expect(cache.keys()).toEqual([]);
    });

    it('treats a value that no longer matches the schema as a miss and drops it', async () => {
      const cache = new InspectableMemoryCache();

      await cache.put('a', { name: 42 }, options);

      expect(await cache.get('a', ItemSchema)).toBeNull();
      expect(cache.keys()).toEqual([]);
    });

    it('counts a schema mismatch as a miss in the meter', async () => {
      const cache = new MemoryCache();
      const hits = vi.fn();
      const misses = vi.fn();
      cache['meter'] = {
        items: { record: vi.fn() },
        hits: { add: hits },
        misses: { add: misses },
      };

      await cache.put('a', { name: 42 }, options);
      await cache.get('a', ItemSchema);

      expect(hits).not.toHaveBeenCalled();
      expect(misses).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate and clear', () => {
    it('invalidates entries by dependency id', async () => {
      const cache = new MemoryCache({ maxEntries: 3 });

      await cache.put('a', { name: 'a' }, { ttlSeconds: 60, dependencyIds: ['x'] });
      await cache.put('b', { name: 'b' }, { ttlSeconds: 60, dependencyIds: ['y'] });
      await cache.put('c', { name: 'c' }, { ttlSeconds: 60, dependencyIds: ['x', 'y'] });
      await cache.invalidate(['x']);

      expect(await has(cache, 'a')).toBe(false);
      expect(await has(cache, 'b')).toBe(true);
      expect(await has(cache, 'c')).toBe(false);
    });

    it('frees room for new entries after invalidation', async () => {
      const cache = new MemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, { ttlSeconds: 60, dependencyIds: ['x'] });
      await cache.put('b', { name: 'b' }, options);
      await cache.invalidate(['x']);
      await cache.put('c', { name: 'c' }, options);

      expect(await has(cache, 'b')).toBe(true);
      expect(await has(cache, 'c')).toBe(true);
    });

    it('clears all entries and keeps working within the limit', async () => {
      const cache = new InspectableMemoryCache({ maxEntries: 2 });

      await cache.put('a', { name: 'a' }, options);
      await cache.put('b', { name: 'b' }, options);
      await cache.clear();

      expect(cache.keys()).toEqual([]);

      await cache.put('c', { name: 'c' }, options);
      await cache.put('d', { name: 'd' }, options);
      await cache.put('e', { name: 'e' }, options);

      expect(cache.keys()).toEqual(['d', 'e']);
    });
  });
});
