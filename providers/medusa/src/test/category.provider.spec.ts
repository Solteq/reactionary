import 'dotenv/config';
import type { RequestContext } from '@reactionary/core';
import {
  CategorySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { MedusaCategoryProvider } from '../providers/category.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { MedusaClient } from '../core/client.js';

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
      slug: 'computer-spare-parts-and-accessories',
    },
  ],

  childCategoriesOfFirstTopcategory: [
    { key: '225', name: 'Printers & Scanners' },
    { key: '830', name: 'Computer Cables' },
  ],

  breadCrumb: ['2833', '225', '373'],
};

describe('Medusa Category Provider', () => {
  let provider: MedusaCategoryProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaCategoryProvider(
      config,
      new NoOpCache(),
      reqCtx,
      client
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
    expect(result.value.items[0].identifier.key).toBe(
      testData.topCategories[0].key
    );
    expect(result.value.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.value.items[1].identifier.key).toBe(
      testData.topCategories[1].key
    );
    expect(result.value.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 10, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    for (const verificationData of testData.childCategoriesOfFirstTopcategory) {
      const found = result.value.items.find(
        (item) => item.identifier.key === verificationData.key
      );
      expect(found).toBeDefined();
      expect(found?.name).toBe(verificationData.name);
    }
  });

  it('should be able to get child categories for a category, paged', async () => {
    const result = await provider.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 1 },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.value.totalCount).toBeGreaterThan(1);
    expect(result.value.totalPages).toBeGreaterThan(1);
    expect(result.value.pageSize).toBe(1);
    expect(result.value.pageNumber).toBe(1);

    const result2 = await provider.findChildCategories({
      parentId: { key: testData.topCategories[0].key },
      paginationOptions: { pageSize: 1, pageNumber: 2 },
    });

    if (!result2.success) {
      assert.fail();
    }

    expect(result2.value.items.length).toBeGreaterThan(0);
    expect(result2.value.totalCount).toBeGreaterThan(1);
    expect(result2.value.totalPages).toBeGreaterThan(1);
    expect(result2.value.pageSize).toBe(1);
    expect(result2.value.pageNumber).toBe(2);

    for (const item of result2.value.items) {
      expect(
        result.value.items.find((i) => i.identifier.key === item.identifier.key)
      ).toBeUndefined();
    }
  });

  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb[testData.breadCrumb.length - 1];
    const result = await provider.getBreadcrumbPathToCategory({
      id: { key: leaf },
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
    const result = await provider.getBySlug({
      slug: testData.topCategories[0].slug,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.name).toBe(testData.topCategories[0].name);
    expect(result.value.slug).toBe(testData.topCategories[0].slug);
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
    const result = await provider.getById({
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
  });

  it.skip('should be able to get a category by id in alternate language', async () => {
    reqCtx.languageContext.locale = 'da';
    const result = await provider.getById({
      id: { key: testData.topCategories[0].key },
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result.value.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.value.name).toBe(testData.topCategories[0].name + ' [da Version]');
    expect(result.value.slug).toBe(testData.topCategories[0].slug + '_da');
    expect(result.value.parentCategory).toBeUndefined();

    expect(result.value.text).toBe(testData.topCategories[0].text + ' [da Version]');
  });

  it.skip('returns NotFound if you choose a language that is not available', async () => {
    reqCtx.languageContext.locale = 'fr-FR';
    const result = await provider.getById({
      id: { key: testData.topCategories[0].key },
    });

    if (result.success) {
      assert.fail();
    }

    expect(result.error.type).toBe('NotFound');
  });

  it('returns NotFound if you search for a category that does not exist', async () => {
    const result = await provider.getById({
      id: { key: 'non-existent-category' },
    });
    
    if (result.success) {
      assert.fail();
    }

    expect(result.error.type).toBe('NotFound');
  });
});
