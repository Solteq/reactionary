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

// TODO: Update IDs and slugs once the HCL instance is confirmed.
// Using placeholder category data aligned with the ICECAT product test data.
const testData = {
  category: {
    // The SEO URL slug for a top-level category (e.g. "Cables")
    slug: 'cables',
    // The uniqueID of the same category as returned by /api/v2/categories
    id: '10001',
    name: 'Cables',
  },
  parentCategory: {
    // A parent category that has child categories
    id: '10000',
    slug: 'electronics',
    name: 'Electronics',
  },
};

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

  it('should get a category by slug', async () => {
    const result = await provider.getBySlug({ slug: testData.category.slug });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.name).toBeTruthy();
    expect(result.value.identifier.key).toBeTruthy();
    expect(result.value.slug).toBeTruthy();
  });

  it('should get a category by id', async () => {
    const result = await provider.getById({
      id: { key: testData.category.id },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.name).toBeTruthy();
    expect(result.value.identifier.key).toBe(testData.category.id);
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
    const result = await provider.getBreadcrumbPathToCategory({
      id: { key: testData.category.id },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.length).toBeGreaterThan(0);
    // Last item should be the category itself
    expect(result.value.at(-1)?.identifier.key).toBe(testData.category.id);
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

  it('should find child categories', async () => {
    const result = await provider.findChildCategories({
      parentId: { key: testData.parentCategory.id },
      paginationOptions: { pageNumber: 1, pageSize: 10 },
    });

    if (!result.success) {
      assert.fail(`Expected success, got: ${JSON.stringify(result)}`);
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBeTruthy();
  });
});
