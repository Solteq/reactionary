import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

const fakeClient = vi.hoisted(() => ({
  isOpen: false,
  on: vi.fn(),
  connect: vi.fn(),
  get: vi.fn(),
  quit: vi.fn(),
}));

// Without an SDK, OpenTelemetry hands out one shared no-op instrument, so the
// counters are replaced to tell hits from misses.
const cacheMeter = vi.hoisted(() => ({
  hits: { add: vi.fn() },
  misses: { add: vi.fn() },
  items: { record: vi.fn() },
}));

vi.mock('redis', () => ({
  createClient: () => fakeClient,
}));

vi.mock('../metrics/metrics.js', () => ({
  getReactionaryCacheMeter: () => cacheMeter,
}));

import { RedisCache } from '../cache/redis-cache.js';

const Schema = z.object({ name: z.string() });

describe('RedisCache', () => {
  beforeEach(() => {
    cacheMeter.hits.add.mockReset();
    cacheMeter.misses.add.mockReset();
    fakeClient.connect.mockReset();
    fakeClient.get.mockReset();
    fakeClient.connect.mockResolvedValue(fakeClient);
  });

  describe('connecting', () => {
    it('retries the connection on a later call after a failed connect', async () => {
      fakeClient.connect
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue(fakeClient);
      fakeClient.get.mockResolvedValue(JSON.stringify({ name: 'a' }));
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.get('k', Schema)).rejects.toThrow('ECONNREFUSED');
      await expect(cache.get('k', Schema)).resolves.toEqual({ name: 'a' });

      expect(fakeClient.connect).toHaveBeenCalledTimes(2);
    });

    it('connects only once while the connection is healthy', async () => {
      fakeClient.get.mockResolvedValue(JSON.stringify({ name: 'a' }));
      const cache = new RedisCache('redis://localhost:6379');

      await cache.get('k', Schema);
      await cache.get('k', Schema);

      expect(fakeClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics', () => {
    it('records a hit for a valid value', async () => {
      const hits = cacheMeter.hits.add;
      const misses = cacheMeter.misses.add;
      fakeClient.get.mockResolvedValue(JSON.stringify({ name: 'a' }));
      const cache = new RedisCache('redis://localhost:6379');

      await cache.get('k', Schema);

      expect(hits).toHaveBeenCalledTimes(1);
      expect(misses).not.toHaveBeenCalled();
    });

    it('records a miss when the key is absent', async () => {
      const hits = cacheMeter.hits.add;
      const misses = cacheMeter.misses.add;
      fakeClient.get.mockResolvedValue(null);
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.get('k', Schema)).resolves.toBeNull();

      expect(misses).toHaveBeenCalledTimes(1);
      expect(hits).not.toHaveBeenCalled();
    });

    it('records a miss when the stored value is not JSON', async () => {
      const misses = cacheMeter.misses.add;
      fakeClient.get.mockResolvedValue('{not json');
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.get('k', Schema)).resolves.toBeNull();

      expect(misses).toHaveBeenCalledTimes(1);
    });

    it('records a miss when the stored value fails the schema', async () => {
      const misses = cacheMeter.misses.add;
      fakeClient.get.mockResolvedValue(JSON.stringify({ name: 42 }));
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.get('k', Schema)).resolves.toBeNull();

      expect(misses).toHaveBeenCalledTimes(1);
    });
  });
});
