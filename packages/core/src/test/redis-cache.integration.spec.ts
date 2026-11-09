import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as z from 'zod';
import { RedisCache } from '../cache/redis-cache.js';

// Runs against a real Redis 7 or later, and is skipped unless REDIS_URL is set:
//   REDIS_URL=redis://127.0.0.1:6379 npx vitest run src/test/redis-cache.integration
const redisUrl = process.env['REDIS_URL'];
const Schema = z.object({ n: z.number() });

describe.skipIf(!redisUrl)('RedisCache against a real Redis', () => {
  const prefix = `reactionary-test-${randomUUID()}:`;
  // Created in beforeAll: the body of a skipped describe still runs.
  let raw: ReturnType<typeof createClient>;
  let cache: RedisCache;

  async function keysWithPrefix(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    for await (const batch of raw.scanIterator({ MATCH: `${prefix}${pattern}` })) {
      keys.push(...batch);
    }

    return keys;
  }

  beforeAll(async () => {
    raw = createClient({ url: redisUrl });
    cache = new RedisCache(redisUrl, { keyPrefix: prefix });
    await raw.connect();
  });

  afterAll(async () => {
    await cache.clear();
    await cache.close();
    await raw.close();
  });

  it('stores and reads an entry under the prefix', async () => {
    await cache.put('entry', { n: 1 }, { ttlSeconds: 60, dependencyIds: [] });

    expect(await cache.get('entry', Schema)).toEqual({ n: 1 });
    expect(await raw.get(`${prefix}entry`)).toBe('{"n":1}');
  });

  it('gives a dependency set an expiry and never shortens it', async () => {
    await cache.put('a', { n: 1 }, { ttlSeconds: 100, dependencyIds: ['ttl'] });
    const first = await raw.ttl(`${prefix}dep:ttl`);
    expect(first).toBeGreaterThan(90);
    expect(first).toBeLessThanOrEqual(100);

    await cache.put('b', { n: 2 }, { ttlSeconds: 10, dependencyIds: ['ttl'] });
    expect(await raw.ttl(`${prefix}dep:ttl`)).toBeGreaterThan(90);

    await cache.put('c', { n: 3 }, { ttlSeconds: 1000, dependencyIds: ['ttl'] });
    expect(await raw.ttl(`${prefix}dep:ttl`)).toBeGreaterThan(990);
  });

  it('leaves no dependency sets behind once the entries have expired', async () => {
    for (let i = 0; i < 50; i++) {
      await cache.put(`short-${i}`, { n: i }, { ttlSeconds: 1, dependencyIds: [`short-dep-${i}`] });
    }
    expect(await keysWithPrefix('dep:short-dep-*')).toHaveLength(50);

    await new Promise((resolve) => setTimeout(resolve, 2200));

    expect(await keysWithPrefix('dep:short-dep-*')).toHaveLength(0);
  }, 15000);

  it('invalidates entries by dependency id', async () => {
    await cache.put('x', { n: 1 }, { ttlSeconds: 60, dependencyIds: ['inv'] });
    await cache.put('y', { n: 2 }, { ttlSeconds: 60, dependencyIds: ['inv'] });

    await cache.invalidate(['inv']);

    expect(await cache.get('x', Schema)).toBeNull();
    expect(await cache.get('y', Schema)).toBeNull();
    expect(await keysWithPrefix('dep:inv')).toHaveLength(0);
  });

  it('clear removes the cache keys and leaves keys outside the prefix alone', async () => {
    const outside = `outside-${randomUUID()}`;
    await raw.set(outside, 'keep');
    await cache.put('z', { n: 1 }, { ttlSeconds: 60, dependencyIds: ['clr'] });

    try {
      await cache.clear();

      expect(await keysWithPrefix('*')).toHaveLength(0);
      expect(await raw.get(outside)).toBe('keep');
    } finally {
      await raw.del(outside);
    }
  });
});
