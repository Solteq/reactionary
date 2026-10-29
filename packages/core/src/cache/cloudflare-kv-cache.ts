import * as z from 'zod';
import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import type { BaseModel } from '../schemas/models/index.js';
import type { InferType } from '../zod-utils.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';

export interface KvGetOptions {
  type: 'text';
  cacheTtl?: number;
}

export interface KvPutOptions {
  expirationTtl?: number;
  metadata?: unknown;
}

export interface KvListOptions {
  prefix?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface KvListKey {
  name: string;
}

export interface KvListResult {
  keys: KvListKey[];
  list_complete: boolean;
  cursor?: string;
}

/**
 * The part of a Cloudflare Workers KV namespace binding (`KVNamespace`) that
 * the cache uses. Declared here so that core does not depend on
 * `@cloudflare/workers-types`. The real binding satisfies it.
 */
export interface KvNamespaceLike {
  get(key: string, options: 'text' | KvGetOptions): Promise<string | null>;
  put(key: string, value: string, options?: KvPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KvListOptions): Promise<KvListResult>;
}

export interface CloudflareKvCacheOptions {
  /**
   * Prepended to every key the cache writes, and the scope of `clear()`.
   * Defaults to `reactionary:`. With an empty prefix `clear()` empties the
   * whole namespace.
   */
  keyPrefix?: string;

  /**
   * Whether to write one index key per dependency id of each entry, which is
   * what `invalidate()` uses to find the entries. Defaults to true. Turn it off
   * to save KV writes when invalidation is not used. `invalidate()` is then a
   * no-op and entries only leave the cache by expiring.
   */
  trackDependencies?: boolean;

  /**
   * Passed to KV `get` as `cacheTtl`, in seconds. It keeps a read cached in the
   * Cloudflare location that served it, which lowers latency but means a write
   * or invalidation from another location is not seen for at least that long.
   * Values below the KV minimum of 30 are raised to it. Not set by default,
   * which leaves KV's own default of 60 seconds.
   */
  edgeCacheTtlSeconds?: number;
}

/**
 * What is stored under a cache key. KV cannot expire a key in under 60 seconds,
 * so the expiry is kept in the value as well and checked on read.
 */
export const CloudflareKvCacheEnvelopeSchema = z.object({
  value: z.unknown(),
  expiresAt: z.number(),
});

export type CloudflareKvCacheEnvelope = InferType<typeof CloudflareKvCacheEnvelopeSchema>;

/**
 * Cache backed by Cloudflare Workers KV, for storefronts running on Workers.
 *
 * KV is eventually consistent: a write or delete can take 60 seconds or more
 * to show in other locations, and a key that was read recently in a location
 * can stay cached there as well. A `get` after `put` or `invalidate` can
 * therefore return the old state. Use it for data that tolerates that.
 *
 * Limits it works around (see the Cloudflare KV documentation):
 * - Keys are limited to 512 bytes and values to 25 MiB. A `put` that exceeds
 *   either is skipped with a warning.
 * - `expirationTtl` is at least 60 seconds. Shorter TTLs are enforced through
 *   the stored envelope and the key is left to KV for garbage collection.
 * - Writes to the same key are limited to one per second, and KV answers with
 *   a 429 error beyond that. The error propagates from `put`.
 * - A Worker invocation can make a limited number of KV operations, so
 *   `invalidate()` and `clear()` can run out of them on large key sets.
 * - KV has no atomic operations, so dependencies are tracked as one index key
 *   per (dependency id, cache key) rather than as a list per dependency id.
 *
 * Errors thrown by the KV binding are not caught here. A corrupt entry, or one
 * that does not match the schema, is a miss.
 */
export class CloudflareKvCache implements Cache {
  /** Only hits and misses are recorded: KV cannot count its keys cheaply, so there is no items gauge. */
  protected meter = getReactionaryCacheMeter();

  protected readonly keyPrefix: string;
  protected readonly trackDependencies: boolean;
  protected readonly edgeCacheTtlSeconds: number | undefined;

  protected readonly maxKeyBytes = 512;
  protected readonly maxValueBytes = 25 * 1024 * 1024;
  protected readonly minExpirationTtlSeconds = 60;
  protected readonly minEdgeCacheTtlSeconds = 30;

  constructor(
    protected readonly kv: KvNamespaceLike,
    options: CloudflareKvCacheOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? 'reactionary:';
    this.trackDependencies = options.trackDependencies ?? true;
    this.edgeCacheTtlSeconds = options.edgeCacheTtlSeconds;
  }

  public async get<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    const value = await this.lookup(key, schema);

    if (value === null) {
      this.meter.misses.add(1, {
        'labels.cache_type': 'cloudflare-kv',
      });

      return null;
    }

    this.meter.hits.add(1, {
      'labels.cache_type': 'cloudflare-kv',
    });

    return value;
  }

  public async put(key: string, value: unknown, options: CacheEntryOptions): Promise<void> {
    if (!key || !Number.isFinite(options.ttlSeconds) || options.ttlSeconds <= 0) {
      return;
    }

    const entryKey = this.buildEntryKey(key);
    const dependencyKeys = this.trackDependencies
      ? [...new Set(options.dependencyIds)].map((id) => this.buildDependencyKey(id, key))
      : [];

    // An entry that cannot be indexed could not be invalidated, so it is not
    // stored at all.
    const oversizedKey = [entryKey, ...dependencyKeys].find((kvKey) => !this.fitsKeyLimit(kvKey));

    if (oversizedKey !== undefined) {
      this.warnSkipped(`a key is over ${this.maxKeyBytes} bytes`, oversizedKey);
      return;
    }

    const serialized = this.encodeEnvelope(value, options.ttlSeconds);

    if (this.byteLength(serialized) > this.maxValueBytes) {
      this.warnSkipped(`the value is over ${this.maxValueBytes} bytes`, entryKey);
      return;
    }

    const expirationTtl = Math.max(this.minExpirationTtlSeconds, Math.ceil(options.ttlSeconds));

    // The index goes first: if the writes fail part way, there is at worst an
    // index key without an entry, never an entry without an index key. A put
    // that runs while an invalidate is deleting the same index keys can still
    // leave an entry that survives until its TTL.
    await Promise.all(
      dependencyKeys.map((dependencyKey) => this.kv.put(dependencyKey, '1', { expirationTtl })),
    );

    await this.kv.put(entryKey, serialized, { expirationTtl });
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    if (!this.trackDependencies) {
      return;
    }

    for (const dependencyId of new Set(dependencyIds)) {
      const dependencyPrefix = this.buildDependencyPrefix(dependencyId);

      for await (const names of this.listKeyPages(dependencyPrefix)) {
        await Promise.all(
          names.map(async (name) => {
            const key = name.slice(dependencyPrefix.length);

            // The entry goes first, so a failed delete leaves the index key to
            // retry from.
            await this.kv.delete(this.buildEntryKey(key));
            await this.kv.delete(name);
          }),
        );
      }
    }
  }

  /**
   * Deletes every key under the cache prefix, one list page at a time. This
   * costs at least one KV operation per key, so it is meant for tests and
   * administration, not for request handling.
   */
  public async clear(): Promise<void> {
    for await (const names of this.listKeyPages(this.keyPrefix)) {
      await Promise.all(names.map((name) => this.kv.delete(name)));
    }
  }

  protected async lookup<T extends BaseModel>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    if (!key) {
      return null;
    }

    const entryKey = this.buildEntryKey(key);

    if (!this.fitsKeyLimit(entryKey)) {
      return null;
    }

    const serialized = await this.readText(entryKey);

    if (serialized === null) {
      return null;
    }

    const envelope = this.decodeEnvelope(serialized);

    if (!envelope || envelope.expiresAt <= Date.now()) {
      return null;
    }

    const parsed = schema.safeParse(envelope.value);

    return parsed.success ? parsed.data : null;
  }

  protected readText(kvKey: string): Promise<string | null> {
    const cacheTtl = this.edgeCacheTtl();

    if (cacheTtl === undefined) {
      return this.kv.get(kvKey, 'text');
    }

    return this.kv.get(kvKey, { type: 'text', cacheTtl });
  }

  protected warnSkipped(reason: string, kvKey: string): void {
    console.warn(`CloudflareKvCache did not store an entry because ${reason}: ${kvKey.slice(0, 120)}`);
  }

  protected edgeCacheTtl(): number | undefined {
    if (this.edgeCacheTtlSeconds === undefined || !Number.isFinite(this.edgeCacheTtlSeconds)) {
      return undefined;
    }

    return Math.max(this.minEdgeCacheTtlSeconds, Math.ceil(this.edgeCacheTtlSeconds));
  }

  protected encodeEnvelope(value: unknown, ttlSeconds: number): string {
    const envelope: CloudflareKvCacheEnvelope = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    return JSON.stringify(envelope);
  }

  protected decodeEnvelope(serialized: string): CloudflareKvCacheEnvelope | null {
    let unvalidated: unknown;

    try {
      unvalidated = JSON.parse(serialized);
    } catch {
      return null;
    }

    const parsed = CloudflareKvCacheEnvelopeSchema.safeParse(unvalidated);

    return parsed.success ? parsed.data : null;
  }

  protected buildEntryKey(key: string): string {
    return `${this.keyPrefix}entry:${key}`;
  }

  /**
   * The dependency id is URI-encoded so that it cannot contain the `:` which
   * ends it. Otherwise invalidating `a` would also match the keys of `a:b`.
   */
  protected buildDependencyPrefix(dependencyId: string): string {
    return `${this.keyPrefix}dep:${encodeURIComponent(dependencyId)}:`;
  }

  protected buildDependencyKey(dependencyId: string, key: string): string {
    return `${this.buildDependencyPrefix(dependencyId)}${key}`;
  }

  protected fitsKeyLimit(kvKey: string): boolean {
    return this.byteLength(kvKey) <= this.maxKeyBytes;
  }

  protected byteLength(text: string): number {
    return new TextEncoder().encode(text).length;
  }

  /**
   * Lists the key names under a prefix, following the cursor. A page can be
   * empty while the listing is not complete, so only `list_complete` ends it.
   */
  protected async *listKeyPages(prefix: string): AsyncGenerator<string[]> {
    let cursor: string | undefined;

    do {
      const page: KvListResult = await this.kv.list(cursor ? { prefix, cursor } : { prefix });

      yield page.keys.map((listed) => listed.name);

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}
