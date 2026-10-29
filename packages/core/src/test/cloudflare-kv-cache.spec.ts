import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { BaseCapability } from '../capabilities/base.capability.js';
import {
  CloudflareKvCache,
  type CloudflareKvCacheEnvelope,
  type CloudflareKvGetOptions,
  type CloudflareKvListOptions,
  type CloudflareKvListResult,
  type CloudflareKvNamespaceLike,
  type CloudflareKvPutOptions,
} from '../cache/cloudflare-kv-cache.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';
import { createInitialRequestContext } from '../initialization.js';
import type { ReactionaryCacheMetrics } from '../metrics/metrics.js';
import { success, type Result } from '../schemas/result.js';

interface StoredValue {
  value: string;
  expiresAt: number | undefined;
  metadata: unknown;
}

interface PutCall {
  key: string;
  expirationTtl: number | undefined;
  metadata: unknown;
}

/**
 * In-memory stand-in for a KV namespace. It follows the documented behaviour
 * the cache depends on: a minimum expirationTtl of 60 seconds, the 512 byte
 * key limit, and key ordered list pages continued by a cursor.
 */
class FakeKvNamespace implements CloudflareKvNamespaceLike {
  public readonly entries = new Map<string, StoredValue>();
  public readonly putCalls: PutCall[] = [];
  public readonly getCalls: Array<{ key: string; options: 'text' | CloudflareKvGetOptions }> = [];
  public readonly listCalls: CloudflareKvListOptions[] = [];

  constructor(public pageSize = 1000) {}

  public async get(key: string, options: 'text' | CloudflareKvGetOptions): Promise<string | null> {
    this.getCalls.push({ key, options });
    this.assertKey(key);

    return this.live().get(key)?.value ?? null;
  }

  public async put(key: string, value: string, options?: CloudflareKvPutOptions): Promise<void> {
    this.assertKey(key);

    const expirationTtl = options?.expirationTtl;

    if (expirationTtl !== undefined && expirationTtl < 60) {
      throw new Error('KV PUT failed: expirationTtl must be at least 60');
    }

    this.putCalls.push({ key, expirationTtl, metadata: options?.metadata });
    this.entries.set(key, {
      value,
      expiresAt: expirationTtl === undefined ? undefined : Date.now() + expirationTtl * 1000,
      metadata: options?.metadata,
    });
    if (options?.metadata !== undefined && new TextEncoder().encode(JSON.stringify(options.metadata)).length > 1024) {
      throw new Error('KV PUT failed: metadata too large');
    }
  }

  public async delete(key: string): Promise<void> {
    this.assertKey(key);
    this.entries.delete(key);
  }

  public async list(options: CloudflareKvListOptions = {}): Promise<CloudflareKvListResult> {
    this.listCalls.push(options);

    const names = [...this.live().keys()]
      .filter((name) => name.startsWith(options.prefix ?? ''))
      .filter((name) => options.cursor == null || name > options.cursor)
      .sort();
    const page = names.slice(0, this.pageSize);
    const complete = names.length <= this.pageSize;

    return {
      keys: page.map((name) => ({ name })),
      list_complete: complete,
      cursor: complete ? undefined : page[page.length - 1],
    };
  }

  public names(): string[] {
    return [...this.live().keys()].sort();
  }

  /** Writes a value under a key, bypassing the cache. */
  public seed(key: string, value: string): void {
    this.entries.set(key, { value, expiresAt: undefined, metadata: undefined });
  }

  protected assertKey(key: string): void {
    if (new TextEncoder().encode(key).length > 512) {
      throw new Error('KV failed: key too long');
    }
  }

  protected live(): Map<string, StoredValue> {
    const now = Date.now();

    for (const [key, stored] of this.entries) {
      if (stored.expiresAt !== undefined && stored.expiresAt <= now) {
        this.entries.delete(key);
      }
    }

    return this.entries;
  }
}

const ProductSchema = z.looseObject({ id: z.string() });

/** The digest the cache is expected to produce: SHA-256 as unpadded base64url. */
async function sha256(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

  return btoa(String.fromCharCode(...hash)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

describe('CloudflareKvCache with readable keys', () => {
  let kv: FakeKvNamespace;
  let cache: CloudflareKvCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    kv = new FakeKvNamespace();
    cache = new CloudflareKvCache(kv, { hashKeys: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('get and put', () => {
    it('returns a stored value validated by the schema', async () => {
      await cache.put('product:1', { id: '1', name: 'Hammer' }, { ttlSeconds: 300, dependencyIds: [] });

      await expect(cache.get('product:1', ProductSchema)).resolves.toEqual({ id: '1', name: 'Hammer' });
    });

    it('returns null for a key that was never stored', async () => {
      await expect(cache.get('missing', ProductSchema)).resolves.toBeNull();
    });

    it('returns null for an empty key without calling KV', async () => {
      await expect(cache.get('', ProductSchema)).resolves.toBeNull();

      expect(kv.getCalls).toEqual([]);
    });

    it('stores the entry under the default prefix', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

      expect(kv.names()).toEqual(['reactionary:entry:a']);
    });

    it('uses a custom prefix', async () => {
      const custom = new CloudflareKvCache(kv, { keyPrefix: 'shop-a:', hashKeys: false });

      await custom.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

      expect(kv.names()).toEqual(['shop-a:entry:a']);
    });
  });

  describe('expiry', () => {
    it('treats an entry as a miss once a TTL under 60 seconds has passed', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 10, dependencyIds: [] });

      vi.advanceTimersByTime(9_000);
      await expect(cache.get('a', ProductSchema)).resolves.toEqual({ id: '1' });

      vi.advanceTimersByTime(1_000);
      expect(kv.names()).toEqual(['reactionary:entry:a']);
      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
    });

    it('raises the KV expirationTtl to 60 seconds for shorter TTLs', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 5, dependencyIds: ['dep'] });

      expect(kv.putCalls.map((call) => call.expirationTtl)).toEqual([60, 60]);
    });

    it('passes a TTL above 60 seconds on unchanged', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 900, dependencyIds: [] });

      expect(kv.putCalls.map((call) => call.expirationTtl)).toEqual([900]);
    });

    it('lets KV drop the key after the clamped expirationTtl', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 5, dependencyIds: [] });

      vi.advanceTimersByTime(61_000);

      expect(kv.names()).toEqual([]);
    });

    it('does not store an entry with a TTL of zero or less', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 0, dependencyIds: [] });
      await cache.put('b', { id: '1' }, { ttlSeconds: -1, dependencyIds: [] });

      expect(kv.putCalls).toEqual([]);
    });
  });

  describe('bad entries', () => {
    it('treats corrupt JSON as a miss', async () => {
      kv.seed('reactionary:entry:a', '{not json');

      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
    });

    it('treats JSON that is not an envelope as a miss', async () => {
      kv.seed('reactionary:entry:a', JSON.stringify({ id: '1' }));

      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
    });

    it('treats a value that does not match the schema as a miss', async () => {
      await cache.put('a', { id: 42 }, { ttlSeconds: 300, dependencyIds: [] });

      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
    });

    it('lets an error from the KV binding propagate', async () => {
      vi.spyOn(kv, 'get').mockRejectedValue(new Error('KV GET failed: 503'));

      await expect(cache.get('a', ProductSchema)).rejects.toThrow('KV GET failed: 503');
    });
  });

  describe('limits', () => {
    it('skips a put whose prefixed key is over 512 bytes and warns', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const key = 'k'.repeat(500);

      await expect(cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: [] })).resolves.toBeUndefined();

      expect(kv.putCalls).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      await expect(cache.get(key, ProductSchema)).resolves.toBeNull();
    });

    it('measures the key limit in UTF-8 bytes', async () => {
      // 200 characters of 3 bytes each is under 512 characters but over 512 bytes.
      const key = 'ä€'.repeat(100);

      await cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

      expect(kv.putCalls).toEqual([]);
    });

    it('accepts a key that just fits', async () => {
      const key = 'k'.repeat(512 - 'reactionary:entry:'.length);

      await cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

      expect(kv.putCalls).toHaveLength(1);
    });

    it('skips the whole entry when an index key would be over the limit', async () => {
      const key = 'k'.repeat(490);

      await cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: ['product:1'] });

      expect(kv.putCalls).toEqual([]);
    });

    it('skips a value over the KV value limit', async () => {
      class SmallValueCache extends CloudflareKvCache {
        protected override readonly maxValueBytes = 100;
      }
      const small = new SmallValueCache(kv, { hashKeys: false });

      await small.put('a', { id: 'x'.repeat(200) }, { ttlSeconds: 300, dependencyIds: ['dep'] });

      expect(kv.putCalls).toEqual([]);
    });
  });

  describe('dependency tracking', () => {
    it('writes one index key per dependency id with the entry TTL', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['product:1', 'category:2'] });

      expect(kv.names()).toEqual([
        'reactionary:dep:category%3A2:a',
        'reactionary:dep:product%3A1:a',
        'reactionary:entry:a',
      ]);
      expect(kv.putCalls.map((call) => call.expirationTtl)).toEqual([300, 300, 300]);
    });

    it('writes the index before the entry', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['dep'] });

      expect(kv.putCalls.map((call) => call.key)).toEqual(['reactionary:dep:dep:a', 'reactionary:entry:a']);
    });

    it('writes an index key once for a repeated dependency id', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['dep', 'dep'] });

      expect(kv.putCalls).toHaveLength(2);
    });

    it('removes the entries and index keys of a dependency id', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['product:1', 'category:2'] });
      await cache.put('b', { id: '2' }, { ttlSeconds: 300, dependencyIds: ['product:2', 'category:2'] });

      await cache.invalidate(['product:1']);

      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
      await expect(cache.get('b', ProductSchema)).resolves.toEqual({ id: '2' });
      expect(kv.names()).toEqual([
        'reactionary:dep:category%3A2:a',
        'reactionary:dep:category%3A2:b',
        'reactionary:dep:product%3A2:b',
        'reactionary:entry:b',
      ]);
    });

    it('removes everything for several dependency ids', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['x'] });
      await cache.put('b', { id: '2' }, { ttlSeconds: 300, dependencyIds: ['y'] });

      await cache.invalidate(['x', 'y']);

      expect(kv.names()).toEqual([]);
    });

    it('follows the cursor across list pages', async () => {
      kv = new FakeKvNamespace(2);
      cache = new CloudflareKvCache(kv, { hashKeys: false });

      for (let index = 0; index < 7; index++) {
        await cache.put(`key-${index}`, { id: `${index}` }, { ttlSeconds: 300, dependencyIds: ['shared'] });
      }
      await cache.put('other', { id: 'o' }, { ttlSeconds: 300, dependencyIds: ['unrelated'] });

      await cache.invalidate(['shared']);

      expect(kv.names()).toEqual(['reactionary:dep:unrelated:other', 'reactionary:entry:other']);
      expect(kv.listCalls.length).toBeGreaterThan(3);
      expect(kv.listCalls.every((call) => call.prefix === 'reactionary:dep:shared:')).toBe(true);
    });

    it('keeps going when a list page is empty but the listing is not complete', async () => {
      const pages: CloudflareKvListResult[] = [
        { keys: [], list_complete: false, cursor: 'c1' },
        { keys: [{ name: 'reactionary:dep:d:a' }], list_complete: true },
      ];
      const spy = vi.spyOn(kv, 'list').mockImplementation(async () => pages.shift() ?? { keys: [], list_complete: true });
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['d'] });

      await cache.invalidate(['d']);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith({ prefix: 'reactionary:dep:d:', cursor: 'c1' });
      expect(kv.names()).toEqual([]);
    });

    it('does not match the keys of a dependency id that starts with the given one', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['product'] });
      await cache.put('b', { id: '2' }, { ttlSeconds: 300, dependencyIds: ['product:1'] });

      await cache.invalidate(['product']);

      await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
      await expect(cache.get('b', ProductSchema)).resolves.toEqual({ id: '2' });
    });

    it('does nothing for an unknown dependency id', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['known'] });
      const before = kv.names();

      await expect(cache.invalidate(['unknown'])).resolves.toBeUndefined();

      expect(kv.names()).toEqual(before);
    });

    it('deletes the entry before its index key, so a failure can be retried', async () => {
      await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['d'] });
      vi.spyOn(kv, 'delete').mockRejectedValueOnce(new Error('KV DELETE failed'));

      await expect(cache.invalidate(['d'])).rejects.toThrow('KV DELETE failed');
      expect(kv.names()).toContain('reactionary:dep:d:a');

      await cache.invalidate(['d']);

      expect(kv.names()).toEqual([]);
    });

    it('writes no index keys and invalidates nothing when tracking is off', async () => {
      const untracked = new CloudflareKvCache(kv, { trackDependencies: false, hashKeys: false });

      await untracked.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['d'] });
      await untracked.invalidate(['d']);

      expect(kv.names()).toEqual(['reactionary:entry:a']);
      expect(kv.listCalls).toEqual([]);
      await expect(untracked.get('a', ProductSchema)).resolves.toEqual({ id: '1' });
    });
  });

  describe('clear', () => {
    it('removes the keys under the prefix and leaves other keys alone', async () => {
      kv = new FakeKvNamespace(2);
      cache = new CloudflareKvCache(kv, { hashKeys: false });
      kv.seed('other:entry:a', 'x');
      kv.seed('reactionary', 'x');

      for (let index = 0; index < 5; index++) {
        await cache.put(`key-${index}`, { id: `${index}` }, { ttlSeconds: 300, dependencyIds: ['d'] });
      }

      await cache.clear();

      expect(kv.names()).toEqual(['other:entry:a', 'reactionary']);
      expect(kv.listCalls.every((call) => call.prefix === 'reactionary:')).toBe(true);
    });

    it('is scoped by a custom prefix', async () => {
      const first = new CloudflareKvCache(kv, { keyPrefix: 'a:', hashKeys: false });
      const second = new CloudflareKvCache(kv, { keyPrefix: 'b:', hashKeys: false });
      await first.put('k', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });
      await second.put('k', { id: '2' }, { ttlSeconds: 300, dependencyIds: [] });

      await first.clear();

      await expect(first.get('k', ProductSchema)).resolves.toBeNull();
      await expect(second.get('k', ProductSchema)).resolves.toEqual({ id: '2' });
    });
  });

  describe('edge cache TTL', () => {
    it('reads with the text type and no cacheTtl by default', async () => {
      await cache.get('a', ProductSchema);

      expect(kv.getCalls[0]?.options).toBe('text');
    });

    it('passes cacheTtl to get', async () => {
      const edge = new CloudflareKvCache(kv, { edgeCacheTtlSeconds: 120, hashKeys: false });

      await edge.get('a', ProductSchema);

      expect(kv.getCalls[0]?.options).toEqual({ type: 'text', cacheTtl: 120 });
    });

    it('raises a cacheTtl under the KV minimum of 30 seconds', async () => {
      const edge = new CloudflareKvCache(kv, { edgeCacheTtlSeconds: 5, hashKeys: false });

      await edge.get('a', ProductSchema);

      expect(kv.getCalls[0]?.options).toEqual({ type: 'text', cacheTtl: 30 });
    });
  });

  describe('metrics', () => {
    it('counts hits and misses with the cloudflare-kv cache type', async () => {
      const hits = vi.fn();
      const misses = vi.fn();

      class MeteredCache extends CloudflareKvCache {
        protected override meter: ReactionaryCacheMetrics = {
          items: { record: vi.fn() },
          hits: { add: hits },
          misses: { add: misses },
        };
      }
      const metered = new MeteredCache(kv, { hashKeys: false });
      await metered.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });
      kv.seed('reactionary:entry:corrupt', 'not json');

      await metered.get('a', ProductSchema);
      await metered.get('missing', ProductSchema);
      await metered.get('corrupt', ProductSchema);

      expect(hits).toHaveBeenCalledTimes(1);
      expect(hits).toHaveBeenCalledWith(1, { 'labels.cache_type': 'cloudflare-kv' });
      expect(misses).toHaveBeenCalledTimes(2);
      expect(misses).toHaveBeenCalledWith(1, { 'labels.cache_type': 'cloudflare-kv' });
    });
  });

  describe('subclassing', () => {
    it('lets a subclass change the envelope', async () => {
      class PlainEnvelopeCache extends CloudflareKvCache {
        protected override encodeEnvelope(key: string, value: unknown, ttlSeconds: number): string {
          const envelope: CloudflareKvCacheEnvelope = { key, value, expiresAt: Date.now() + ttlSeconds * 1000 };
          return `v1${JSON.stringify(envelope)}`;
        }

        protected override decodeEnvelope(serialized: string): CloudflareKvCacheEnvelope | null {
          return super.decodeEnvelope(serialized.slice(2));
        }
      }
      const custom = new PlainEnvelopeCache(kv, { hashKeys: false });

      await custom.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

      expect(kv.entries.get('reactionary:entry:a')?.value.startsWith('v1{')).toBe(true);
      await expect(custom.get('a', ProductSchema)).resolves.toEqual({ id: '1' });
    });
  });

  describe('with the @Reactionary decorator', () => {
    const QuerySchema = z.object({ id: z.string() });
    const calls: string[] = [];

    class KvCachedCapability extends BaseCapability {
      @Reactionary({
        inputSchema: QuerySchema,
        outputSchema: ProductSchema,
        cache: true,
        cacheTimeToLiveInSeconds: 300,
      })
      public async getById(query: z.infer<typeof QuerySchema>): Promise<Result<z.infer<typeof ProductSchema>>> {
        calls.push(query.id);
        return success({ id: query.id });
      }

      public override generateDependencyIdsForModel(model: unknown): Array<string> {
        const parsed = ProductSchema.safeParse(model);
        return parsed.success ? [`product:${parsed.data.id}`] : [];
      }

      protected getResourceName(): string {
        return 'KvCachedCapability';
      }
    }

    it('misses first, then hits, then misses again after invalidation', async () => {
      calls.length = 0;
      const hashed = new CloudflareKvCache(kv);
      const capability = new KvCachedCapability(hashed, createInitialRequestContext());

      const first = await capability.getById({ id: '1' });
      // The decorator does not wait for the cache write.
      await vi.waitFor(() => expect(kv.names()).toHaveLength(2));
      const second = await capability.getById({ id: '1' });

      expect(first.success && first.meta.cache.hit).toBe(false);
      expect(second.success && second.meta.cache.hit).toBe(true);
      expect(second.success && second.value).toEqual({ id: '1' });
      expect(calls).toEqual(['1']);

      await hashed.invalidate(['product:1']);

      const third = await capability.getById({ id: '1' });
      expect(third.success && third.meta.cache.hit).toBe(false);
      expect(calls).toEqual(['1', '1']);
    });

    it('stops hitting once the TTL has passed', async () => {
      calls.length = 0;
      const capability = new KvCachedCapability(new CloudflareKvCache(kv), createInitialRequestContext());

      await capability.getById({ id: '2' });
      await vi.waitFor(() => expect(kv.names()).toHaveLength(2));
      vi.advanceTimersByTime(301_000);
      const result = await capability.getById({ id: '2' });

      expect(result.success && result.meta.cache.hit).toBe(false);
      expect(calls).toEqual(['2', '2']);
    });
  });
});

describe('CloudflareKvCache with hashed keys', () => {
  let kv: FakeKvNamespace;
  let cache: CloudflareKvCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    kv = new FakeKvNamespace();
    cache = new CloudflareKvCache(kv);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is the default and stores the entry and index under digests', async () => {
    await cache.put('product:1', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['dep:1'] });

    const keyDigest = await sha256('product:1');
    expect(kv.names()).toEqual(
      [`reactionary:dep:${await sha256('dep:1')}:${keyDigest}`, `reactionary:entry:${keyDigest}`].sort(),
    );
    expect(keyDigest).toHaveLength(43);
    await expect(cache.get('product:1', ProductSchema)).resolves.toEqual({ id: '1' });
  });

  it('stores and reads back a cache key of more than 1 KB without skipping it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const key = `Scope.query:${'x'.repeat(2000)}:all:all`;
    const dependencyId = `product:${'y'.repeat(1500)}`;

    await cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: [dependencyId] });

    expect(kv.putCalls).toHaveLength(2);
    expect(kv.putCalls.every((call) => new TextEncoder().encode(call.key).length < 200)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    await expect(cache.get(key, ProductSchema)).resolves.toEqual({ id: '1' });

    await cache.invalidate([dependencyId]);

    await expect(cache.get(key, ProductSchema)).resolves.toBeNull();
    expect(kv.names()).toEqual([]);
  });

  it('accepts a dependency id that is not well-formed text', async () => {
    await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['\ud800'] });

    await cache.invalidate(['\ud800']);

    expect(kv.names()).toEqual([]);
  });

  it('keeps the original key in the envelope and in the KV metadata', async () => {
    await cache.put('product:1', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['d'] });

    const entry = kv.putCalls.find((call) => call.key.startsWith('reactionary:entry:'));
    const index = kv.putCalls.find((call) => call.key.startsWith('reactionary:dep:'));
    expect(entry?.metadata).toEqual({ key: 'product:1' });
    expect(index?.metadata).toBeUndefined();
    expect(JSON.parse(kv.entries.get(entry?.key ?? '')?.value ?? '')).toMatchObject({ key: 'product:1' });
  });

  it('truncates the metadata to 1024 bytes of JSON and still writes the entry', async () => {
    const key = `${'ä'.repeat(3000)}"quoted"`;

    await cache.put(key, { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });

    const metadata = kv.putCalls[0]?.metadata;
    const size = new TextEncoder().encode(JSON.stringify(metadata)).length;
    expect(size).toBeLessThanOrEqual(1024);
    expect(size).toBeGreaterThan(900);
    expect(metadata).toEqual({ key: expect.stringMatching(/^ä+$/) });
    await expect(cache.get(key, ProductSchema)).resolves.toEqual({ id: '1' });
  });

  it('treats an entry stored for another key as a miss', async () => {
    await cache.put('a', { id: '1' }, { ttlSeconds: 300, dependencyIds: [] });
    const stored = kv.putCalls[0];
    const impostor = JSON.stringify({ key: 'someone-else', value: { id: '1' }, expiresAt: Date.now() + 60_000 });
    kv.seed(`reactionary:entry:${await sha256('b')}`, impostor);
    kv.seed(stored?.key ?? '', impostor);

    await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
    await expect(cache.get('b', ProductSchema)).resolves.toBeNull();
  });

  it('treats an entry without a stored key as a miss', async () => {
    kv.seed(`reactionary:entry:${await sha256('a')}`, JSON.stringify({ value: { id: '1' }, expiresAt: Date.now() + 60_000 }));

    await expect(cache.get('a', ProductSchema)).resolves.toBeNull();
  });

  it('invalidates entries and index keys across list pages', async () => {
    kv = new FakeKvNamespace(2);
    cache = new CloudflareKvCache(kv);

    for (let index = 0; index < 7; index++) {
      await cache.put(`key-${index}`, { id: `${index}` }, { ttlSeconds: 300, dependencyIds: ['shared', `own-${index}`] });
    }
    await cache.put('other', { id: 'o' }, { ttlSeconds: 300, dependencyIds: ['unrelated'] });

    await cache.invalidate(['shared']);

    const otherDigest = await sha256('other');
    expect(kv.names().filter((name) => name.startsWith('reactionary:entry:'))).toEqual([`reactionary:entry:${otherDigest}`]);
    // The index keys of the removed entries' other dependency ids stay until
    // they expire; the shared ones are gone.
    const sharedPrefix = `reactionary:dep:${await sha256('shared')}:`;
    expect(kv.names().filter((name) => name.startsWith(sharedPrefix))).toEqual([]);
    expect(kv.listCalls.length).toBeGreaterThan(3);
    expect(kv.listCalls.every((call) => call.prefix === sharedPrefix)).toBe(true);
    await expect(cache.get('other', ProductSchema)).resolves.toEqual({ id: 'o' });
    await expect(cache.get('key-3', ProductSchema)).resolves.toBeNull();
  });

  it('clears only the keys under the prefix', async () => {
    kv = new FakeKvNamespace(2);
    cache = new CloudflareKvCache(kv);
    kv.seed('other:entry:a', 'x');

    for (let index = 0; index < 5; index++) {
      await cache.put(`key-${index}`, { id: `${index}` }, { ttlSeconds: 300, dependencyIds: ['d'] });
    }

    await cache.clear();

    expect(kv.names()).toEqual(['other:entry:a']);
    expect(kv.listCalls.every((call) => call.prefix === 'reactionary:')).toBe(true);
  });

  it('still skips a value over the KV value limit', async () => {
    class SmallValueCache extends CloudflareKvCache {
      protected override readonly maxValueBytes = 100;
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await new SmallValueCache(kv).put('a', { id: 'x'.repeat(200) }, { ttlSeconds: 300, dependencyIds: ['d'] });

    expect(kv.putCalls).toEqual([]);
  });

  it('lets a subclass change the hash', async () => {
    class LengthCache extends CloudflareKvCache {
      protected override async digest(text: string): Promise<string> {
        return `len${text.length}`;
      }
    }
    const custom = new LengthCache(kv);

    await custom.put('abc', { id: '1' }, { ttlSeconds: 300, dependencyIds: ['xy'] });

    expect(kv.names()).toEqual(['reactionary:dep:len2:len3', 'reactionary:entry:len3']);
    await expect(custom.get('abc', ProductSchema)).resolves.toEqual({ id: '1' });

    await custom.invalidate(['xy']);

    expect(kv.names()).toEqual([]);
  });
});
