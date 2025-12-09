import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CategorySchema,
  MemoryCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { FakeCategoryProvider } from '../providers/index.js';
import { getFakerTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeAll, beforeEach, assert } from 'vitest';

describe('Faker Category Provider', () => {
  let provider: FakeCategoryProvider;
  let reqCtx: RequestContext;
  const cache = new MemoryCache();

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    cache.clear();

    provider = new FakeCategoryProvider(
      getFakerTestConfiguration(),
      cache,
      reqCtx
    );
  });

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe('grocery');
    expect(result.value.items[0].name).toBe('Grocery');

    expect(result.value.items[1].identifier.key).toBe('sports');
    expect(result.value.items[1].name).toBe('Sports');
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({
      parentId: { key: 'grocery' },
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe('grocery-0');
    expect(result.value.items[0].name).toBe('Grocery-0');

    expect(result.value.items[1].identifier.key).toBe('grocery-1');
    expect(result.value.items[1].name).toBe('Grocery-1');
  });

  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({
      parentId: { key: 'grocery' },
      paginationOptions: { pageSize: 1, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe('grocery-0');
    expect(result.value.items[0].name).toBe('Grocery-0');
    expect(result.value.totalCount).toBeGreaterThan(1);
    expect(result.value.totalPages).toEqual(result.value.totalCount);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(1);

    result = await provider.findChildCategories({
      parentId: { key: 'grocery' },
      paginationOptions: { pageSize: 1, pageNumber: 2 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe('grocery-1');
    expect(result.value.items[0].name).toBe('Grocery-1');
    expect(result.value.totalCount).toBeGreaterThan(1);
    expect(result.value.totalPages).toEqual(result.value.totalCount);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(2);
  });

  it('can load all breadcrumbs for a category', async () => {
    const result = await provider.getBreadcrumbPathToCategory({
      id: { key: 'grocery-0-0' },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.length).toBeGreaterThan(2);
    expect(result.value[0].identifier.key).toBe('grocery');
    expect(result.value[0].name).toBe('Grocery');
    expect(result.value[0].slug).toBe('grocery-slug');

    expect(result.value[1].identifier.key).toBe('grocery-0');
    expect(result.value[1].name).toBe('Grocery-0');
    expect(result.value[1].slug).toBe('grocery-0-slug');

    expect(result.value[2].identifier.key).toBe('grocery-0-0');
    expect(result.value[2].name).toBe('Grocery-0-0');
    expect(result.value[2].slug).toBe('grocery-0-0-slug');
  });

  it('should be able to get a category by slug', async () => {
    const result = await provider.getBySlug({ slug: 'grocery-slug' });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('grocery');
    expect(result.value.name).toBe('Grocery');
    expect(result.value.slug).toBe('grocery-slug');
    expect(result.value.parentCategory).toBeUndefined();
    expect(result.value.text).not.toBe('');
  });

  it('returns NotFound if looking for slug that does not exist', async () => {
    const result = await provider.getBySlug({ slug: 'non-existent-slug' });
    
    if (result.success) {
      assert.fail();
    }

    expect(result.error.type).toBe('NotFound');
  });

  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: 'grocery' } });
    
    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe('grocery');
    expect(result.value.name).toBe('Grocery');
    expect(result.value.slug).toBe('grocery-slug');
    expect(result.value.parentCategory).toBeUndefined();

    expect(result.value.text).not.toBe('');
  });

  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({
      id: { key: 'non-existent-category' },
    });

    if (!result.success) {
      assert.fail();
    }
    
    expect(result.value.identifier.key).toBe('non-existent-category');
  });

  describe('caching', () => {
    // TODO: These should probably be elsewhere, since they are really testing the caches and the decorator together.
    // Perhaps as an integration test

    it('should cache the results for byId', async () => {
      const first = await provider.getById({ id: { key: 'grocery' } });

      if (!first.success) {
        assert.fail();
      }

      const second = await provider.getById({ id: { key: 'grocery' } });

      if (!second.success) {
        assert.fail();
      }
    });

    it('can clear a cache entry by dependency id', async () => {
      const first = await provider.getById({ id: { key: 'grocery' } });

      if (!first.success) {
        assert.fail();
      }

      const dependencyIds = provider.generateDependencyIdsForModel(first);
      await cache.invalidate(dependencyIds);

      const second = await provider.getById({ id: { key: 'grocery' } });

      if (!second.success) {
        assert.fail();
      }
    });
  });
});
