import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

const fakeClient = vi.hoisted(() => ({
  isOpen: false,
  on: vi.fn(),
  connect: vi.fn(),
  get: vi.fn(),
  quit: vi.fn(),
  destroy: vi.fn(),
  sMembers: vi.fn(),
  del: vi.fn(),
  multi: vi.fn(),
  dbSize: vi.fn(),
}));

const createClient = vi.hoisted(() => vi.fn());

// Without an SDK, OpenTelemetry hands out one shared no-op instrument, so the
// counters are replaced to tell hits from misses.
const cacheMeter = vi.hoisted(() => ({
  hits: { add: vi.fn() },
  misses: { add: vi.fn() },
  items: { record: vi.fn() },
}));

vi.mock('redis', () => ({
  createClient,
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
    fakeClient.quit.mockReset();
    fakeClient.destroy.mockReset();
    fakeClient.isOpen = false;
    createClient.mockReset();
    createClient.mockReturnValue(fakeClient);
  });

  describe('client configuration', () => {
    it('keeps new RedisCache(url) working with bounded defaults', () => {
      new RedisCache('redis://localhost:6379');

      expect(createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        disableOfflineQueue: true,
        commandsQueueMaxLength: 1000,
        socket: { connectTimeout: 1000 },
      });
    });

    it('applies the connect timeout option', () => {
      new RedisCache('redis://localhost:6379', { connectTimeoutMs: 250 });

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ socket: { connectTimeout: 250 } }),
      );
    });

    it('lets clientOptions override the defaults and merge into socket', () => {
      new RedisCache('redis://localhost:6379', {
        clientOptions: {
          disableOfflineQueue: false,
          database: 3,
          socket: { reconnectStrategy: false },
        },
      });

      expect(createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        disableOfflineQueue: false,
        commandsQueueMaxLength: 1000,
        database: 3,
        socket: { connectTimeout: 1000, reconnectStrategy: false },
      });
    });

    it('takes the url from the constructor, not from clientOptions', () => {
      new RedisCache('redis://primary:6379', {
        clientOptions: { url: 'redis://other:6379' },
      });

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'redis://primary:6379' }),
      );
    });
  });

  describe('timeouts', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects get when Redis stops answering', async () => {
      vi.useFakeTimers();
      fakeClient.get.mockReturnValue(new Promise(() => undefined));
      const cache = new RedisCache('redis://localhost:6379', {
        operationTimeoutMs: 200,
      });

      const result = expect(cache.get('k', Schema)).rejects.toThrow(
        'timed out after 200ms',
      );
      await vi.advanceTimersByTimeAsync(200);

      await result;
    });

    it('rejects get when the connection is never established', async () => {
      vi.useFakeTimers();
      fakeClient.connect.mockReturnValue(new Promise(() => undefined));
      const cache = new RedisCache('redis://localhost:6379', {
        operationTimeoutMs: 200,
      });

      const result = expect(cache.get('k', Schema)).rejects.toThrow(
        'timed out after 200ms',
      );
      await vi.advanceTimersByTimeAsync(200);

      await result;
      expect(fakeClient.get).not.toHaveBeenCalled();
    });

    it('rejects put when Redis stops answering', async () => {
      vi.useFakeTimers();
      fakeClient.multi.mockReturnValue({
        set: vi.fn(),
        sAdd: vi.fn(),
        exec: () => new Promise(() => undefined),
      });
      const cache = new RedisCache('redis://localhost:6379', {
        operationTimeoutMs: 200,
      });

      const result = expect(
        cache.put('k', { name: 'a' }, { ttlSeconds: 10, dependencyIds: ['d'] }),
      ).rejects.toThrow('timed out after 200ms');
      await vi.advanceTimersByTimeAsync(200);

      await result;
    });

    it('does not time out a fast operation and leaves no timer behind', async () => {
      vi.useFakeTimers();
      fakeClient.get.mockResolvedValue(JSON.stringify({ name: 'a' }));
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.get('k', Schema)).resolves.toEqual({ name: 'a' });

      expect(vi.getTimerCount()).toBe(0);
    });

    it('applies the timeout to each round trip of invalidate, not to all of them together', async () => {
      const slow = <T>(value: T) => () =>
        new Promise<T>((resolve) => setTimeout(() => resolve(value), 60));
      fakeClient.sMembers.mockImplementation(slow(['entry']));
      fakeClient.del.mockImplementation(slow(1));
      fakeClient.dbSize.mockImplementation(slow(0));
      const cache = new RedisCache('redis://localhost:6379', {
        operationTimeoutMs: 150,
      });

      await expect(cache.invalidate(['a', 'b', 'c'])).resolves.toBeUndefined();

      expect(fakeClient.del).toHaveBeenCalledWith(['entry', 'dep:a']);
      expect(fakeClient.del).toHaveBeenCalledWith(['entry', 'dep:c']);
    });

    it('destroys the connection on close without waiting for QUIT', async () => {
      fakeClient.isOpen = true;
      const cache = new RedisCache('redis://localhost:6379');

      await expect(cache.close()).resolves.toBeUndefined();

      expect(fakeClient.destroy).toHaveBeenCalledTimes(1);
      expect(fakeClient.quit).not.toHaveBeenCalled();
    });

    it('does nothing on close when the client is not open', async () => {
      const cache = new RedisCache('redis://localhost:6379');

      await cache.close();

      expect(fakeClient.destroy).not.toHaveBeenCalled();
    });
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
