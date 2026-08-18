import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createHclClient } from './test-utils.js';

// Demo server: www-latestdevauth.demo.solteq.io, storeId=41
// Category identifiers are external identifiers (HclCategoryResponse.identifier),
// not internal uniqueIDs.
const testData = {
  topCategories: [
    { key: 'LivingRoom', name: 'Living Room', slug: 'living-room' },
    { key: 'Bath', name: 'Bath' },
  ],

  childCategoriesOfFirstTopCategory: [
    { key: 'LivingRoomFurniture', name: 'Furniture' },
    { key: 'LivingRoomLighting', name: 'Lighting' },
  ],

  categoryWithDescription: [
    {
      key: 'LivingRoom',
      name: 'Living Room',
      text: 'Bring your living space together with comfort and style',
    },
  ],

  // Leaf category for breadcrumb test. Expected path: [LivingRoom, LivingRoomFurniture]
  breadCrumb: ['LivingRoom', 'LivingRoomFurniture'],
};

describe('HCL Category Capability', () => {
  let client: ReturnType<typeof createHclClient>;

  beforeEach(() => {
    client = createHclClient();
  });

  it('should be able to get top-categories', async () => {
    const result = await client.category.findTopCategories({
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe(
      testData.topCategories[0].key,
    );
    expect(result.value.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.value.items[1].identifier.key).toBe(
      testData.topCategories[1].key,
    );
    expect(result.value.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identifier: {
            key: testData.childCategoriesOfFirstTopCategory[0].key,
          },
          name: testData.childCategoriesOfFirstTopCategory[0].name,
        }),
        expect.objectContaining({
          identifier: {
            key: testData.childCategoriesOfFirstTopCategory[1].key,
          },
          name: testData.childCategoriesOfFirstTopCategory[1].name,
        }),
      ]),
    );
  });

  it('should be able to get child categories for a category, paged', async () => {
    let result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.totalCount).toBe(3);
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(1);

    const idFrom1 = result.value.items[0].identifier.key;

    result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 2 },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.totalCount).toBe(3);
    expect(result.value.pageNumber).toBe(2);
    expect(result.value.items[0].identifier.key).not.toBe(idFrom1);
  });

  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb.at(-1);
    if (!leaf) assert.fail('breadCrumb testData is empty');
    const result = await client.category.getBreadcrumbPathToCategory({
      id: { key: leaf },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.length).toBe(testData.breadCrumb.length);
    for (let i = 0; i < testData.breadCrumb.length; i++) {
      expect(result.value.at(i)?.identifier.key).toBe(testData.breadCrumb[i]);
    }
  });

  it('should be able to get a category by slug', async () => {
    const topCat = testData.topCategories[0];
    if (!topCat?.slug) assert.fail('testData.topCategories[0] has no slug');
    const result = await client.category.getBySlug({
      slug: topCat.slug,
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.identifier.key).toBe(topCat.key);
    expect(result.value.name).toBe(topCat.name);
    expect(result.value.slug).toBe(topCat.slug);
    expect(result.value.parentCategory).toBeUndefined();
  });

  it('can fetch a category with a description', async () => {
    const result = await client.category.getById({
      id: { key: testData.categoryWithDescription[0].key },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.identifier.key).toBe(
      testData.categoryWithDescription[0].key,
    );
    expect(result.value.name).toBe(testData.categoryWithDescription[0].name);
    expect(result.value.text).toBe(testData.categoryWithDescription[0].text);
  });
});
