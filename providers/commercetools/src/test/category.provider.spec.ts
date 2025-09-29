import 'dotenv/config'
import type { RequestContext} from '@reactionary/core';
import { CategorySchema, NoOpCache, Session , createInitialRequestContext} from '@reactionary/core';
import { CommercetoolsCategoryProvider } from '../providers/category.provider';
import { getCommercetoolsTestConfiguration } from './test-utils';

const testData = {
  topCategories: [
    {
      key: 'home-decor', name: 'Home Decor', slug: 'home-decor'
    },
    {
      key: 'furniture', name: 'Furniture'
    }
  ],

  childCategoriesOfFirstTopcategory: [
    { key: 'bedding', name: 'Bedding' },
    { key: 'room-decor', name: 'Room Decor' }
  ],

  breadCrumb: [ 'home-decor', 'room-decor', 'home-accents' ],
}


describe('Commercetools Category Provider', () => {
  let provider: CommercetoolsCategoryProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new CommercetoolsCategoryProvider(getCommercetoolsTestConfiguration(), CategorySchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  })

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({ paginationOptions: { pageSize: 10, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.topCategories[0].key);
    expect(result.items[0].name).toBe(testData.topCategories[0].name);

    expect(result.items[1].identifier.key).toBe(testData.topCategories[1].key);
    expect(result.items[1].name).toBe(testData.topCategories[1].name);
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 10, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[0].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[0].name);

    expect(result.items[1].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[1].key);
    expect(result.items[1].name).toBe(testData.childCategoriesOfFirstTopcategory[1].name);

  });


  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[0].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[0].name);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await provider.findChildCategories({ parentId: { key: testData.topCategories[0].key }, paginationOptions: { pageSize: 1, pageNumber: 2 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe(testData.childCategoriesOfFirstTopcategory[1].key);
    expect(result.items[0].name).toBe(testData.childCategoriesOfFirstTopcategory[1].name);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });


  it('can load all breadcrumbs for a category', async () => {
    const leaf = testData.breadCrumb[testData.breadCrumb.length -1];
    const result = await provider.getBreadcrumbPathToCategory({ id: { key: leaf! } }, reqCtx);

    expect(result.length).toBe(testData.breadCrumb.length);
    for(let i = 0 ; i < testData.breadCrumb.length; i++) {
      expect(result[i].identifier.key).toBe(testData.breadCrumb[i]);
    }
  });


  it('should be able to get a category by slug', async () => {

    const result = await provider.getBySlug({ slug: testData.topCategories[0].slug! }, reqCtx);
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
    const result = await provider.getBySlug({ slug: 'non-existent-slug' }, reqCtx);
    expect(result).toBeNull();
  });



  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: 'home-decor'}}, reqCtx);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('Home Decor');
    expect(result.slug).toBe('home-decor');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe('A test description');
    expect(result.meta.placeholder).toBe(false);

  });

 it('should be able to get a category by id in alternate language', async () => {

    reqCtx.languageContext.locale = 'de-DE';
    const result = await provider.getById({ id: { key: 'home-decor'}}, reqCtx);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('Dekoration');
    expect(result.slug).toBe('home-decor');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe('Eine Testbeschreibung');
    expect(result.meta.placeholder).toBe(false);

  });


  it('returns empty values if you choose a language that is not available', async () => {

    reqCtx.languageContext.locale = 'fr-FR';
    const result = await provider.getById({ id: { key: 'home-decor'}}, reqCtx);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('No Name');
    expect(result.slug).toBe('');
    expect(result.parentCategory).toBeUndefined();

    expect(result.meta.placeholder).toBe(false);

  });



  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({ id: { key: 'non-existent-category'}}, reqCtx);
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);

  });
});
