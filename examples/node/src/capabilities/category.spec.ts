import 'dotenv/config';
import { describe, expect, it, beforeEach } from 'vitest';
import { createClient } from '../utils.js';

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

describe('Category Capability', () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient();
  });

  it('should be able to get top-categories', async () => {
    const result = await client.category.findTopCategories({
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.topCategories[0].key);
    expect(result.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.items[1].identifier.key).toBe(testData.topCategories[1].key);
    expect(result.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[0].key
    );
    expect(result.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[0].name
    );

    expect(result.items[1].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[1].key
    );
    expect(result.items[1].name).toBe(
      testData.childCategoriesOfFirstTopcategory[1].name
    );
  });

  it('should be able to get child categories for a category, paged', async () => {
    let result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 1 },
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[0].key
    );
    expect(result.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[0].name
    );
    expect(result.totalCount).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await client.category.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 2 },
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(
      testData.childCategoriesOfFirstTopcategory[1].key
    );
    expect(result.items[0].name).toBe(
      testData.childCategoriesOfFirstTopcategory[1].name
    );
    expect(result.totalCount).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });

  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb[testData.breadCrumb.length - 1];
    const result = await client.category.getBreadcrumbPathToCategory({
      id: { key: leaf! },
    });

    expect(result.length).toBe(testData.breadCrumb.length);
    for (let i = 0; i < testData.breadCrumb.length; i++) {
      expect(result[i].identifier.key).toBe(testData.breadCrumb[i]);
    }
  });

  it('should be able to get a category by slug', async () => {
    const result = await client.category.getBySlug({
      slug: testData.topCategories[0].slug!,
    });
    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.key).toBe(testData.topCategories[0].key);
      expect(result.name).toBe(testData.topCategories[0].name);
      expect(result.slug).toBe(testData.topCategories[0].slug);
      expect(result.parentCategory).toBeUndefined();
      expect(result.text).not.toBe('');
      expect(result.meta.placeholder).toBe(false);
    }
  });

  it('returns null if looking for slug that does not exist', async () => {
    const result = await client.category.getBySlug({ slug: 'non-existent-slug' });
    expect(result).toBeNull();
  });

  it('should be able to get a category by id', async () => {
    const result = await client.category.getById({
      id: { key: testData.topCategories[0].key },
    });

    expect(result.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.name).toBe(testData.topCategories[0].name);
    expect(result.slug).toBe(testData.topCategories[0].slug);
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe(testData.topCategories[0].text);
    expect(result.meta.placeholder).toBe(false);
  });

  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await client.category.getById({
      id: { key: 'non-existent-category' },
    });
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);
  });
});
