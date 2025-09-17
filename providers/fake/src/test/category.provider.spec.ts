import 'dotenv/config'


import { CategorySchema, NoOpCache, Session } from '@reactionary/core';
import { FakeCategoryProvider } from '../providers';
import { createAnonymousTestSession, getFakerTestConfiguration } from './test-utils';
describe('Faker Category Provider', () => {
  let provider: FakeCategoryProvider;
  let session: Session;



  beforeAll( () => {
    provider = new FakeCategoryProvider(getFakerTestConfiguration(), CategorySchema, new NoOpCache());
  });

  beforeEach( () => {
    session = createAnonymousTestSession()
  })

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({ paginationOptions: { pageSize: 10, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery');
    expect(result.items[0].name).toBe('Grocery');

    expect(result.items[1].identifier.key).toBe('sports');
    expect(result.items[1].name).toBe('Sports');
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 10, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-0');
    expect(result.items[0].name).toBe('Grocery-0');

    expect(result.items[1].identifier.key).toBe('grocery-1');
    expect(result.items[1].name).toBe('Grocery-1');

  });


  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 1, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-0');
    expect(result.items[0].name).toBe('Grocery-0');
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.totalPages).toEqual(result.totalCount);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 1, pageNumber: 2 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-1');
    expect(result.items[0].name).toBe('Grocery-1');
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.totalPages).toEqual(result.totalCount);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });


  it('can load all breadcrumbs for a category', async () => {
    const result = await provider.getBreadcrumbPathToCategory({ id: { key: 'grocery-0-0' } }, session);

    expect(result.length).toBeGreaterThan(2);
    expect(result[0].identifier.key).toBe('grocery');
    expect(result[0].name).toBe('Grocery');
    expect(result[0].slug).toBe('grocery-slug');

    expect(result[1].identifier.key).toBe('grocery-0');
    expect(result[1].name).toBe('Grocery-0');
    expect(result[1].slug).toBe('grocery-0-slug');

    expect(result[2].identifier.key).toBe('grocery-0-0');
    expect(result[2].name).toBe('Grocery-0-0');
    expect(result[2].slug).toBe('grocery-0-0-slug');

  });


  it('should be able to get a category by slug', async () => {
    const result = await provider.getBySlug({ slug: 'grocery-slug' }, session);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.key).toBe('grocery');
      expect(result.name).toBe('Grocery');
      expect(result.slug).toBe('grocery-slug');
      expect(result.parentCategory).toBeUndefined();
      expect(result.text).not.toBe("");
      expect(result.meta.placeholder).toBe(false);
    }
  });

  it('returns null if looking for slug that does not exist', async () => {
    const result = await provider.getBySlug({ slug: 'non-existent-slug' }, session);
    expect(result).toBeNull();
  });



  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: 'grocery'}}, session);

    expect(result.identifier.key).toBe('grocery');
    expect(result.name).toBe('Grocery');
    expect(result.slug).toBe('grocery-slug');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).not.toBe("");
    expect(result.meta.placeholder).toBe(false);

  });





  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({ id: { key: 'non-existent-category'}}, session);
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);

  });


});
