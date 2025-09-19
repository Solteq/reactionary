import 'dotenv/config';
import { CategorySchema, MemoryCache, RequestContext , createInitialRequestContext,} from '@reactionary/core';
import { FakeCategoryProvider } from '../providers';
import { getFakerTestConfiguration } from './test-utils';

describe('Faker Category Provider', () => {
  let provider: FakeCategoryProvider;
  let reqCtx: RequestContext;
  const cache = new MemoryCache();

  beforeAll(() => {
    provider = new FakeCategoryProvider(
      getFakerTestConfiguration(),
      CategorySchema,
      cache
    );
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext();
    cache.clear();
  })

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({ paginationOptions: { pageSize: 10, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery');
    expect(result.items[0].name).toBe('Grocery');

    expect(result.items[1].identifier.key).toBe('sports');
    expect(result.items[1].name).toBe('Sports');
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 10, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-0');
    expect(result.items[0].name).toBe('Grocery-0');

    expect(result.items[1].identifier.key).toBe('grocery-1');
    expect(result.items[1].name).toBe('Grocery-1');
  });

  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 1, pageNumber: 1 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-0');
    expect(result.items[0].name).toBe('Grocery-0');
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.totalPages).toEqual(result.totalCount);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await provider.findChildCategories({ parentId: { key: 'grocery' }, paginationOptions: { pageSize: 1, pageNumber: 2 }}, reqCtx);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('grocery-1');
    expect(result.items[0].name).toBe('Grocery-1');
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.totalPages).toEqual(result.totalCount);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });

  it('can load all breadcrumbs for a category', async () => {
    const result = await provider.getBreadcrumbPathToCategory({ id: { key: 'grocery-0-0' } }, reqCtx);

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
    const result = await provider.getBySlug({ slug: 'grocery-slug' }, reqCtx);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.key).toBe('grocery');
      expect(result.name).toBe('Grocery');
      expect(result.slug).toBe('grocery-slug');
      expect(result.parentCategory).toBeUndefined();
      expect(result.text).not.toBe('');
      expect(result.meta.placeholder).toBe(false);
    }
  });

  it('returns null if looking for slug that does not exist', async () => {
    const result = await provider.getBySlug({ slug: 'non-existent-slug' }, reqCtx);
    expect(result).toBeNull();
  });

  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: 'grocery'}}, reqCtx);

    expect(result.identifier.key).toBe('grocery');
    expect(result.name).toBe('Grocery');
    expect(result.slug).toBe('grocery-slug');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).not.toBe('');
    expect(result.meta.placeholder).toBe(false);
  });

  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({ id: { key: 'non-existent-category'}}, reqCtx);
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);
  });

  describe('caching', () => {
    // TODO: These should probably be elsewhere, since they are really testing the caches and the decorator together.
    // Perhaps as an integration test

    it('should cache the results for byId', async () => {
      const first = await provider.getById({ id: { key: 'grocery' } }, reqCtx);
      expect(first.meta.cache.hit).toBe(false);

      const second = await provider.getById(
        { id: { key: 'grocery' } },
        reqCtx
      );
      expect(second.meta.cache.hit).toBe(true);
    });

    it('can clear a cache entry by dependency id', async () => {
      const first = await provider.getById({ id: { key: 'grocery' } }, reqCtx);

      const dependencyIds = provider.generateDependencyIdsForModel(first);
      await cache.invalidate(dependencyIds);

      const second = await provider.getById(
        { id: { key: 'grocery' } },
        reqCtx
      );
      expect(second.meta.cache.hit).toBe(false);
    });
  });
});
