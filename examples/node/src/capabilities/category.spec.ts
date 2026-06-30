import 'dotenv/config';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';

const testData = {
  topCategories: [
    {
      key: '1883',
      name: 'Tools used in the home and garden such as power drills, spades and screwdrivers.',
      slug: 'work-tools-and-hardware',
    },
    {
      key: '2554',
      name: 'Electrical Equipment & Supplies',
    },
  ],

  childCategoriesOfFirstTopcategory: [
    { key: '1355', name: 'Hand Tools' },
    { key: '1884', name: 'Power Tools' },
  ],

  categoryWithDescription: [
    { key: '1730', name: 'Hot Glue Guns & Pens', text: 'Hot glue guns and pens are tools designed to melt and apply adhesive sticks for bonding various materials securely. They provide quick-setting and strong adhesion used in crafting, repairs, and assembly tasks.' },
  ],

  breadCrumb: ['1883', '1355'],
};

describe.each([PrimaryProvider.COMMERCETOOLS, PrimaryProvider.MEDUSA])('Category Capability - %s', (provider) => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient(provider);
  });

  it('should be able to get top-categories', async () => {
    const result = await client.category.findTopCategories({
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail(JSON.stringify(result.error));
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
      assert.fail(JSON.stringify(result.error));
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.items).toEqual(

        expect.arrayContaining([
          expect.objectContaining({
            identifier: { key: testData.childCategoriesOfFirstTopcategory[0].key },
            name: testData.childCategoriesOfFirstTopcategory[0].name,
          }),

          expect.objectContaining({
            identifier: { key: testData.childCategoriesOfFirstTopcategory[1].key },
            name: testData.childCategoriesOfFirstTopcategory[1].name,
          }),

        ])
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
      assert.fail(JSON.stringify(result.error)  );
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.totalCount).toBe(3);
    expect(result.value.totalPages).toBe(3);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(2);

    expect(result.value.items[0].identifier.key).not.toBe(idFrom1);
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
    }
  });

  it('can fetch a category with a description', async () => {
    const result = await client.category.getById({
      id: { key: testData.categoryWithDescription[0].key },
    });

    if (!result.success) {
      assert.fail();
    }
    expect(result.value.identifier.key).toBe(testData.categoryWithDescription[0].key);
    expect(result.value.name).toBe(testData.categoryWithDescription[0].name);
    assert(result.value.text.startsWith(testData.categoryWithDescription[0].text!.substring(0, 10)));
  })

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
