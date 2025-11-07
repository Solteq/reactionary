import 'dotenv/config'
import type { RequestContext} from '@reactionary/core';
import { CategorySchema, NoOpCache , createInitialRequestContext} from '@reactionary/core';
import { CommercetoolsCategoryProvider } from '../providers/category.provider.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { CommercetoolsClient } from '../core/client.js';

const testData = {
  topCategories: [
    {
      key: 'cat_1575', name: 'Fashion & Lifestyle', slug: 'fashion-and-lifestyle', text: 'Clothes such as jeans and sweaters, and accessories such as hats and belts.'
    },
    {
      key: 'cat_2248', name: 'Pet Care'
    }
  ],

  childCategoriesOfFirstTopcategory: [
    { key: 'cat_1210', name: 'Clothing Care' },
    { key: 'cat_1054', name: 'Key Tags' }
  ],

  breadCrumb: [ 'cat_1575', 'cat_1210' ],
}


describe('Commercetools Category Provider', () => {
  let provider: CommercetoolsCategoryProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const config = getCommercetoolsTestConfiguration();
    const client = new CommercetoolsClient(config, reqCtx);

    provider = new CommercetoolsCategoryProvider(config, CategorySchema, new NoOpCache(), reqCtx, client);
  })

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({ paginationOptions: { pageSize: 10, pageNumber: 1 }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.topCategories[0].key);
    expect(result.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.items[1].identifier.key).toBe(testData.topCategories[1].key);
    expect(result.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 10, pageNumber: 1 }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[0].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[0].name);

    expect(result.items[1].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[1].key);
    expect(result.items[1].name).toBe(testData.childCategoriesOfFirstTopcategory[1].name);

  });


  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 1 }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[0].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[0].name);
    expect(result.totalCount).toBe(6);
    expect(result.totalPages).toBe(6);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 2 }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[1].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[1].name);
    expect(result.totalCount).toBe(6);
    expect(result.totalPages).toBe(6);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });


  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb[testData.breadCrumb.length -1];
    const result = await provider.getBreadcrumbPathToCategory({ id: { key: leaf! } });

    expect(result.length).toBe(testData.breadCrumb.length);
    for(let i = 0 ; i < testData.breadCrumb.length; i++) {
      expect(result[i].identifier.key).toBe(testData.breadCrumb[i]);
    }
  });


  it('should be able to get a category by slug', async () => {

    const result = await provider.getBySlug({ slug: testData.topCategories[0].slug! });
    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.key).toBe(testData.topCategories[0].key);
      expect(result.name).toBe(testData.topCategories[0].name);
      expect(result.slug).toBe(testData.topCategories[0].slug);
      expect(result.parentCategory).toBeUndefined();
      expect(result.text).not.toBe("");
      expect(result.meta.placeholder).toBe(false);
    }
  });

  it('returns null if looking for slug that does not exist', async () => {
    const result = await provider.getBySlug({ slug: 'non-existent-slug' });
    expect(result).toBeNull();
  });



  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: testData.topCategories[0].key }});

    expect(result.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.name).toBe(testData.topCategories[0].name);
    expect(result.slug).toBe(testData.topCategories[0].slug);
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe(testData.topCategories[0].text);
    expect(result.meta.placeholder).toBe(false);

  });

 it('should be able to get a category by id in alternate language', async () => {

    reqCtx.languageContext.locale = 'da';
    const result = await provider.getById({ id: { key: testData.topCategories[0].key }});

    expect(result.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.name).toBe(testData.topCategories[0].name + ' [da Version]');
    expect(result.slug).toBe(testData.topCategories[0].slug + '_da');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe(testData.topCategories[0].text + ' [da Version]');
    expect(result.meta.placeholder).toBe(false);
  });


  it('returns empty values if you choose a language that is not available', async () => {
    reqCtx.languageContext.locale = 'fr-FR';
    const result = await provider.getById({ id: { key: testData.topCategories[0].key }});

    expect(result.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.name).toBe('No Name');
    expect(result.slug).toBe('');
    expect(result.parentCategory).toBeUndefined();

    expect(result.meta.placeholder).toBe(false);

  });

  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({ id: { key: 'non-existent-category'}});
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);

  });
});
