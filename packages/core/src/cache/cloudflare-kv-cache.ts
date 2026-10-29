import * as z from 'zod';
import { getReactionaryCacheMeter } from '../metrics/metrics.js';
import type { BaseModel } from '../schemas/models/index.js';
import type { InferType } from '../zod-utils.js';
import type { Cache, CacheEntryOptions } from './cache.interface.js';

export interface CloudflareKvGetOptions {
  type: 'text';
  cacheTtl?: number;
}

export interface CloudflareKvPutOptions {
  expirationTtl?: number;
  metadata?: unknown;
}

export interface CloudflareKvListOptions {
  prefix?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface CloudflareKvListKey {
  name: string;
}

export interface CloudflareKvListResult {
  keys: CloudflareKvListKey[];
  list_complete: boolean;
  cursor?: string;
}

/**
 * The part of a Cloudflare Workers KV namespace binding (`KVNamespace`) that
 * the cache uses. Declared here so that core does not depend on
 * `@cloudflare/workers-types`. The real binding satisfies it.
 */
export interface CloudflareKvNamespaceLike {
  get(key: string, options: 'text' | CloudflareKvGetOptions): Promise<string | null>;
  put(key: string, value: string, options?: CloudflareKvPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: CloudflareKvListOptions): Promise<CloudflareKvListResult>;
}

/**
 * Keeps a Worker running until a promise has settled, after the response has been sent: `ctx.waitUntil` of the
 * Worker's execution context.
 */
export type CloudflareKvWaitUntil = (promise: Promise<unknown>) => void;

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
   * Whether the cache key and dependency ids are replaced by a SHA-256 digest
   * in the KV keys. Defaults to true. KV keys are limited to 512 bytes, and
   * hashing keeps every key far below that however long the cache key is. The
   * original cache key is kept in the entry's metadata, so an entry can still
   * be recognised in `list` output and the Cloudflare dashboard. With false the
   * keys are readable, and an entry whose key would exceed 512 bytes is not
   * stored.
   */
  hashKeys?: boolean;

  /**
   * Passed to KV `get` as `cacheTtl`, in seconds. It keeps a read cached in the
   * Cloudflare location that served it, which lowers latency but means a write
   * or invalidation from another location is not seen for at least that long.
   * Values below the KV minimum of 30 are raised to it. Not set by default,
   * which leaves KV's own default of 60 seconds.
   */
  edgeCacheTtlSeconds?: number;

  /**
   * Called with the promise of every `put`, so that the Worker keeps running until the write has finished when the
   * response is sent first. Pass `ctx.waitUntil.bind(ctx)`. `@Reactionary` does not wait for a cache write, and
   * a Worker can stop work that is still running when its response has been sent, so without this a write can be
   * cancelled and the entry is never stored. The write is not delayed by it: it starts at once, and `put` still
   * returns the promise of the write, which rejects if the write fails. The promise handed to `waitUntil` never rejects.
   * Not set by default, which leaves a write unattended.
   */
  waitUntil?: CloudflareKvWaitUntil;
}

/**
 * What is stored under a cache key. KV cannot expire a key in under 60 seconds,
 * so the expiry is kept in the value as well and checked on read. The cache key
 * is kept so that a read can tell it got the entry it asked for.
 */
export const CloudflareKvCacheEnvelopeSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  expiresAt: z.number(),
});

export type CloudflareKvCacheEnvelope = InferType<typeof CloudflareKvCacheEnvelopeSchema>;

/**
 * The KV metadata written with an entry. It is not read back by the cache, it
 * is there to identify entries in `list` output and the dashboard.
 */
export const CloudflareKvEntryMetadataSchema = z.object({
  key: z.string(),
});

export type CloudflareKvEntryMetadata = InferType<typeof CloudflareKvEntryMetadataSchema>;

/**
 * Cache backed by Cloudflare Workers KV, for storefronts running on Workers.
 *
 * KV is eventually consistent: a write or delete can take 60 seconds or more
 * to show in other locations, and a key that was read recently in a location
 * can stay cached there as well. A `get` after `put` or `invalidate` can
 * therefore return the old state. Use it for data that tolerates that.
 *
 * Limits it works around (see the Cloudflare KV documentation):
 * - Keys are limited to 512 bytes and values to 25 MiB. By default the cache
 *   key is hashed, so the key limit is not reached. A `put` whose value
 *   exceeds the limit, or whose key does when hashing is off, is skipped with
 *   a warning.
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
  protected readonly hashKeys: boolean;
  protected readonly edgeCacheTtlSeconds: number | undefined;
  protected readonly waitUntil: CloudflareKvWaitUntil | undefined;

  protected readonly encoder = new TextEncoder();
  protected readonly maxKeyBytes = 512;
  protected readonly maxValueBytes = 25 * 1024 * 1024;
  protected readonly maxMetadataBytes = 1024;
  protected readonly minExpirationTtlSeconds = 60;
  protected readonly minEdgeCacheTtlSeconds = 30;

  constructor(
    protected readonly kv: CloudflareKvNamespaceLike,
    options: CloudflareKvCacheOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? 'reactionary:';
    this.trackDependencies = options.trackDependencies ?? true;
    this.hashKeys = options.hashKeys ?? true;
    this.edgeCacheTtlSeconds = options.edgeCacheTtlSeconds;
    this.waitUntil = options.waitUntil;
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

  public put(key: string, value: unknown, options: CacheEntryOptions): Promise<void> {
    const write = this.store(key, value, options);
    this.keepAlive(write);

    return write;
  }

  /**
   * Hands a write to `waitUntil`, if there is one. The failure of the write is for the caller of `put`, so what is
   * handed over never rejects. Never throws.
   */
  protected keepAlive(write: Promise<void>): void {
    if (!this.waitUntil) {
      return;
    }

    try {
      this.waitUntil(write.catch(() => undefined));
    } catch (err) {
      console.warn('Cloudflare KV cache: waitUntil failed, the write is not kept alive', err);
    }
  }

  protected async store(key: string, value: unknown, options: CacheEntryOptions): Promise<void> {
    if (!key || !Number.isFinite(options.ttlSeconds) || options.ttlSeconds <= 0) {
      return;
    }

    const keySegment = await this.buildKeySegment(key);
    const entryKey = this.buildEntryKey(keySegment);
    const dependencyKeys = this.trackDependencies
      ? await Promise.all(
          [...new Set(options.dependencyIds)].map(async (id) =>
            this.buildDependencyKey(await this.buildDependencyPrefix(id), keySegment),
          ),
        )
      : [];

    // An entry that cannot be indexed could not be invalidated, so it is not
    // stored at all. With hashed keys this cannot happen.
    const oversizedKey = [entryKey, ...dependencyKeys].find((kvKey) => !this.fitsKeyLimit(kvKey));

    if (oversizedKey !== undefined) {
      this.warnSkipped(`a key is over ${this.maxKeyBytes} bytes`, oversizedKey);
      return;
    }

    const serialized = this.encodeEnvelope(key, value, options.ttlSeconds);

    if (this.byteLength(serialized) > this.maxValueBytes) {
      this.warnSkipped(`the value is over ${this.maxValueBytes} bytes`, key);
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

    await this.kv.put(entryKey, serialized, { expirationTtl, metadata: this.buildMetadata(key) });
  }

  public async invalidate(dependencyIds: Array<string>): Promise<void> {
    if (!this.trackDependencies) {
      return;
    }

    for (const dependencyId of new Set(dependencyIds)) {
      const dependencyPrefix = await this.buildDependencyPrefix(dependencyId);

      for await (const names of this.listKeyPages(dependencyPrefix)) {
        await Promise.all(
          names.map(async (name) => {
            // The entry goes first, so a failed delete leaves the index key to
            // retry from.
            await this.kv.delete(this.entryKeyFromDependencyKey(name, dependencyPrefix));
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

    const entryKey = this.buildEntryKey(await this.buildKeySegment(key));

    if (!this.fitsKeyLimit(entryKey)) {
      return null;
    }

    const serialized = await this.readText(entryKey);

    if (serialized === null) {
      return null;
    }

    const envelope = this.decodeEnvelope(serialized);

    // The stored key can only differ from the requested one if two cache keys
    // hash to the same digest, which is practically unreachable with SHA-256.
    if (!envelope || envelope.key !== key || envelope.expiresAt <= Date.now()) {
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

  protected encodeEnvelope(key: string, value: unknown, ttlSeconds: number): string {
    const envelope: CloudflareKvCacheEnvelope = {
      key,
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

  /**
   * The metadata for an entry. KV allows 1024 bytes of JSON, so a long cache
   * key is cut to fit. Metadata only helps recognise an entry, so it must never
   * make the write fail.
   */
  protected buildMetadata(key: string): CloudflareKvEntryMetadata {
    let shortened = key;
    let size = this.byteLength(JSON.stringify({ key: shortened }));

    while (shortened.length > 0 && size > this.maxMetadataBytes) {
      shortened = shortened.slice(0, Math.min(shortened.length - 1, Math.floor((shortened.length * this.maxMetadataBytes) / size)));
      size = this.byteLength(JSON.stringify({ key: shortened }));
    }

    return { key: shortened };
  }

  /**
   * The part of a KV key that stands for a cache key: its digest, or the key
   * itself when hashing is off. Dependency index keys end with the same
   * segment as the entry they point to.
   */
  protected async buildKeySegment(key: string): Promise<string> {
    return this.hashKeys ? this.digest(key) : key;
  }

  /**
   * The part of a dependency index key that stands for a dependency id. Without
   * hashing the id is URI-encoded so that it cannot contain the `:` which ends
   * it. Otherwise invalidating `a` would also match the keys of `a:b`.
   */
  protected async buildDependencySegment(dependencyId: string): Promise<string> {
    return this.hashKeys ? this.digest(dependencyId) : encodeURIComponent(dependencyId);
  }

  protected buildEntryKey(keySegment: string): string {
    return `${this.keyPrefix}entry:${keySegment}`;
  }

  protected async buildDependencyPrefix(dependencyId: string): Promise<string> {
    return `${this.keyPrefix}dep:${await this.buildDependencySegment(dependencyId)}:`;
  }

  protected buildDependencyKey(dependencyPrefix: string, keySegment: string): string {
    return `${dependencyPrefix}${keySegment}`;
  }

  protected entryKeyFromDependencyKey(dependencyKey: string, dependencyPrefix: string): string {
    return this.buildEntryKey(dependencyKey.slice(dependencyPrefix.length));
  }

  /**
   * Fixed length text for a piece of a key: SHA-256 as base64url without
   * padding, 43 characters. Override to use another hash, keeping the output
   * free of `:` and of a length that fits the 512 byte key limit.
   */
  protected async digest(text: string): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', this.encoder.encode(text)));

    return btoa(String.fromCharCode(...hash))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  protected fitsKeyLimit(kvKey: string): boolean {
    return this.byteLength(kvKey) <= this.maxKeyBytes;
  }

  protected byteLength(text: string): number {
    return this.encoder.encode(text).length;
  }

  /**
   * Lists the key names under a prefix, following the cursor. A page can be
   * empty while the listing is not complete, so only `list_complete` ends it.
   */
  protected async *listKeyPages(prefix: string): AsyncGenerator<string[]> {
    let cursor: string | undefined;

    do {
      const page: CloudflareKvListResult = await this.kv.list(cursor ? { prefix, cursor } : { prefix });

      yield page.keys.map((listed) => listed.name);

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}
