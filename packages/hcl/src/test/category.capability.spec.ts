import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  CategorySchema,
  CategoryPaginatedResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { HclCategoryCapability } from '../capabilities/category.capability.js';
import { HclCategoryFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { getHclTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';

describe('HCL Category Provider', () => {
  let provider: HclCategoryCapability;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getHclTestConfiguration();
    const client = new HclClient(config);
    provider = new HclCategoryCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclCategoryFactory(CategorySchema, CategoryPaginatedResultSchema),
    );
  });

  it('should find top-level categories', async () => {
    const result = await provider.findTopCategories({
      paginationOptions: { pageNumber: 1, pageSize: 10 },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBeTruthy();
  });

  it('should get a category by id', async () => {
    // Discover a real category ID from findTopCategories
    const top = await provider.findTopCategories({
      paginationOptions: { pageNumber: 1, pageSize: 1 },
    });
    if (!top.success || top.value.items.length === 0) {
      assert.fail('findTopCategories returned no results — cannot derive ID');
    }

    const id = top.value.items[0].identifier;
    const result = await provider.getById({ id });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.identifier.key).toBe(id.key);
    expect(result.value.name).toBeTruthy();
  });

  it('should get a category by slug', async () => {
    // Discover a real slug from findTopCategories
    const top = await provider.findTopCategories({
      paginationOptions: { pageNumber: 1, pageSize: 1 },
    });
    if (!top.success || top.value.items.length === 0) {
      assert.fail('findTopCategories returned no results — cannot derive slug');
    }

    const slug = top.value.items[0].slug;
    if (!slug) assert.fail('Top category has no slug — cannot test getBySlug');

    const result = await provider.getBySlug({ slug });

    if (!result.success) {
      assert.fail(
        `Expected success for slug "${slug}", got: ${JSON.stringify(result)}`,
      );
    }

    expect(result.value.slug).toBeTruthy();
    expect(result.value.name).toBeTruthy();
  });

  it('should return NotFound for an unknown category slug', async () => {
    const result = await provider.getBySlug({
      slug: 'this-category-does-not-exist-xyz-99999',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('should get breadcrumb path to a category', async () => {
    // Discover a real category ID first
    const top = await provider.findTopCategories({
      paginationOptions: { pageNumber: 1, pageSize: 1 },
    });
    if (!top.success || top.value.items.length === 0) {
      assert.fail('findTopCategories returned no results — cannot derive ID');
    }

    const id = top.value.items[0].identifier;
    const result = await provider.getBreadcrumbPathToCategory({ id });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value.at(-1)?.identifier.key).toBe(id.key);
  });

  it('should find child categories', async () => {
    // Discover a parent category that has children
    const top = await provider.findTopCategories({
      paginationOptions: { pageNumber: 1, pageSize: 5 },
    });
    if (!top.success || top.value.items.length === 0) {
      assert.fail(
        'findTopCategories returned no results — cannot derive parent ID',
      );
    }

    const parentId = top.value.items[0].identifier;
    const result = await provider.findChildCategories({
      parentId,
      paginationOptions: { pageNumber: 1, pageSize: 10 },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    // May be empty if the top category has no children — that's still valid
    expect(result.value.items).toBeDefined();
  });
});
