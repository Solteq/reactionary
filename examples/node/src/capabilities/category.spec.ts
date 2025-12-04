import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  topCategories: [
    {
      key: '2833',
      name: 'Computers & Peripherals',
      slug: 'computers-and-peripherals',
      text: 'Computers & Peripherals',
    },
    {
      key: '9541',
      name: 'Computer Spare Parts & Accessories',
    },
  ],

  childCategoriesOfFirstTopcategory: [
    { key: '225', name: 'Printers & Scanners' },
    { key: '830', name: 'Computer Cables' },
  ],

  breadCrumb: ['2833', '225'],
};

describe.each([PrimaryProvider.COMMERCETOOLS])('Category Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should be able to get top-categories', async () => {
    const result = await client.category.findTopCategories({
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe(testData.topCategories[0].key);
    expect(result.value.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.value.items[1].identifier.key).toBe(testData.topCategories[1].key);
    expect(result.value.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[0].key
    );
    expect(result.value.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[0].name
    );

    expect(result.value.items[1].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[1].key
    );
    expect(result.value.items[1].name).toBe(
      testData.childCategoriesOfFirstTopcategory[1].name
    );
  });

  it('should be able to get child categories for a category, paged', async () => {
    let result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 1 },
    });
    
    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[0].key
    );
    expect(result.value.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[0].name
    );
    expect(result.value.totalCount).toBe(3);
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(1);

    result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 2 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[1].key
    );
    expect(result.value.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[1].name
    );
    expect(result.value.totalCount).toBe(3);
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(2);
  });

  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb[testData.breadCrumb.length - 1];
    const result = await client.category.getBreadcrumbPathToCategory({
      id: { key: leaf! },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.length).toBe(testData.breadCrumb.length);
    for (let i = 0; i < testData.breadCrumb.length; i++) {
      expect(result.value[i].identifier.key).toBe(testData.breadCrumb[i]);
    }
  });

  it('should be able to get a category by slug', async () => {
    const result = await client.category.getBySlug({
      slug: testData.topCategories[0].slug!,
    });
    
    if (!result.success) {
      assert.fail();
    }

    if (result) {
      expect(result.value.identifier.key).toBe(testData.topCategories[0].key);
      expect(result.value.name).toBe(testData.topCategories[0].name);
      expect(result.value.slug).toBe(testData.topCategories[0].slug);
      expect(result.value.parentCategory).toBeUndefined();
      expect(result.value.text).not.toBe('');
      expect(result.value.meta.placeholder).toBe(false);
    }
  });

  it('returns NotFound if looking for slug that does not exist', async () => {
    const result = await client.category.getBySlug({ slug: 'non-existent-slug' });
    
    if (result.success) {
      assert.fail();
    }

    expect(result.error.type).toBe('NotFound');
  });

  it('should be able to get a category by id', async () => {
    const result = await client.category.getById({
      id: { key: testData.topCategories[0].key },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.value.name).toBe(testData.topCategories[0].name);
    expect(result.value.slug).toBe(testData.topCategories[0].slug);
    expect(result.value.parentCategory).toBeUndefined();

    expect(result.value.text).toBe(testData.topCategories[0].text);
    expect(result.value.meta.placeholder).toBe(false);
  });

  it('returns NotFound if you search for a category that does not exist', async () => {
    const result = await client.category.getById({
      id: { key: 'non-existent-category' },
    });
    
    if (result.success) {
      assert.fail();
    }

    expect(result.error.type).toBe('NotFound');
  });
});
