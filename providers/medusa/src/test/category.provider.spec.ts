import 'dotenv/config'
import type { RequestContext} from '@reactionary/core';
import { CategorySchema, NoOpCache , createInitialRequestContext} from '@reactionary/core';
import { MedusaCategoryProvider } from '../providers/category.provider.js';
import { getMedusaTestConfiguration } from './test-utils.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { MedusaClient } from '../core/client.js';

const testData = {
  topCategories: [
    {
      key: '2833', name: 'Computers & Peripherals', slug: 'computers-and-peripherals', text: 'Computers & Peripherals'
    },
    {
      key: '9541', name: 'Computer Spare Parts & Accessories', slug: 'computer-spare-parts-and-accessories'
    }
  ],

  childCategoriesOfFirstTopcategory: [
    { key: '225', name: 'Printers & Scanners' },
    { key: '830', name: 'Computer Cables' },
  ],

  breadCrumb: [ '2833', '225','373' ],
}


describe('Medusa Category Provider', () => {
  let provider: MedusaCategoryProvider;
  let reqCtx: RequestContext;

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaCategoryProvider(config, CategorySchema, new NoOpCache(), reqCtx, client);
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


    for(const verificationData of testData.childCategoriesOfFirstTopcategory) {
      const found = result.items.find( (item) => item.identifier.key === verificationData.key);
      expect(found).toBeDefined();
      expect(found?.name).toBe(verificationData.name);
    }

  });


  it('should be able to get child categories for a category, paged', async () => {
    const result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 1 }});

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.totalPages).toBeGreaterThan(1);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    const result2 = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 2 }});

    expect(result2.items.length).toBeGreaterThan(0);
    expect(result2.totalCount).toBeGreaterThan(1);
    expect(result2.totalPages).toBeGreaterThan(1);
    expect(result2.pageSize).toBe(1);
    expect(result2.pageNumber).toBe(2);

    for(const item of result2.items ) {
      expect(result.items.find(i => i.identifier.key === item.identifier.key)).toBeUndefined();
    }
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
 //     expect(result.identifier.key).toBe(testData.topCategories[0].key);
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

 it.skip('should be able to get a category by id in alternate language', async () => {
    reqCtx.languageContext.locale = 'da';
    const result = await provider.getById({ id: { key: testData.topCategories[0].key }});

    expect(result.identifier.key).toBe(testData.topCategories[0].key);
    expect(result.name).toBe(testData.topCategories[0].name + ' [da Version]');
    expect(result.slug).toBe(testData.topCategories[0].slug + '_da');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe(testData.topCategories[0].text + ' [da Version]');
    expect(result.meta.placeholder).toBe(false);
  });


  it.skip('returns empty values if you choose a language that is not available', async () => {
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
