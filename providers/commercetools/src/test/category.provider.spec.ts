import 'dotenv/config'

    import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

import { CategorySchema, NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { CommercetoolsCategoryProvider } from '../providers/category.provider';
import { createAnonymousTestSession, getCommercetoolsTestConfiguration } from './test-utils';
import { getTracer, shutdownOtel } from '@reactionary/otel';
describe('Commercetools Category Provider', () => {
  let provider: CommercetoolsCategoryProvider;
  let session: Session;

  beforeAll( () => {
    provider = new CommercetoolsCategoryProvider(getCommercetoolsTestConfiguration(), CategorySchema, new NoOpCache());
  });

  beforeEach( () => {
    session = createAnonymousTestSession()
  })

  it('should be able to get top-categories', async () => {
    const result = await provider.findTopCategories({ paginationOptions: { pageSize: 10, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('home-decor');
    expect(result.items[0].name).toBe('Home Decor');

    expect(result.items[1].identifier.key).toBe('furniture');
    expect(result.items[1].name).toBe('Furniture');
  });

  it('should be able to get child categories for a category', async () => {
    const result = await provider.findChildCategories({ parentId: { key: 'home-decor' }, paginationOptions: { pageSize: 10, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('bedding');
    expect(result.items[0].name).toBe('Bedding');

    expect(result.items[1].identifier.key).toBe('room-decor');
    expect(result.items[1].name).toBe('Room Decor');

  });


  it('should be able to get child categories for a category, paged', async () => {
    let result = await provider.findChildCategories({ parentId: { key: 'home-decor' }, paginationOptions: { pageSize: 1, pageNumber: 1 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('bedding');
    expect(result.items[0].name).toBe('Bedding');
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(1);

    result = await provider.findChildCategories({ parentId: { key: 'home-decor' }, paginationOptions: { pageSize: 1, pageNumber: 2 }}, session);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].identifier.key).toBe('room-decor');
    expect(result.items[0].name).toBe('Room Decor');
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.pageNumber).toBe(2);
  });


  it('can load all breadcrumbs for a category', async () => {
    const result = await provider.getBreadcrumbPathToCategory({ id: { key: 'home-accents' } }, session);

    expect(result.length).toBeGreaterThan(2);
    expect(result[0].identifier.key).toBe('home-decor');
    expect(result[0].name).toBe('Home Decor');
    expect(result[0].slug).toBe('home-decor');

    expect(result[1].identifier.key).toBe('room-decor');
    expect(result[1].name).toBe('Room Decor');
    expect(result[1].slug).toBe('room-decor');

    expect(result[2].identifier.key).toBe('home-accents');
    expect(result[2].name).toBe('Home Accents');
    expect(result[2].slug).toBe('home-accents');

  });


  it('should be able to get a category by slug', async () => {
    const result = await provider.getBySlug({ slug: 'home-decor' }, session);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.identifier.key).toBe('home-decor');
      expect(result.name).toBe('Home Decor');
      expect(result.slug).toBe('home-decor');
      expect(result.parentCategory).toBeUndefined();
      expect(result.text).toBe('A test description');
      expect(result.meta.placeholder).toBe(false);
    }
  });

  it('returns null if looking for slug that does not exist', async () => {
    const result = await provider.getBySlug({ slug: 'non-existent-slug' }, session);
    expect(result).toBeNull();
  });



  it('should be able to get a category by id', async () => {
    const result = await provider.getById({ id: { key: 'home-decor'}}, session);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('Home Decor');
    expect(result.slug).toBe('home-decor');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe('A test description');
    expect(result.meta.placeholder).toBe(false);

  });

 it('should be able to get a category by id in alternate language', async () => {

    session.languageContext.locale = 'de-DE';
    const result = await provider.getById({ id: { key: 'home-decor'}}, session);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('Dekoration');
    expect(result.slug).toBe('home-decor');
    expect(result.parentCategory).toBeUndefined();

    expect(result.text).toBe('Eine Testbeschreibung');
    expect(result.meta.placeholder).toBe(false);

  });


  it('returns empty values if you choose a language that is not available', async () => {

    session.languageContext.locale = 'fr-FR';
    const result = await provider.getById({ id: { key: 'home-decor'}}, session);

    expect(result.identifier.key).toBe('home-decor');
    expect(result.name).toBe('No Name');
    expect(result.slug).toBe('');
    expect(result.parentCategory).toBeUndefined();

    expect(result.meta.placeholder).toBe(false);

  });



  it('returns a placeholder if you search for a category that does not exist', async () => {
    const result = await provider.getById({ id: { key: 'non-existent-category'}}, session);
    expect(result.identifier.key).toBe('non-existent-category');
    expect(result.meta.placeholder).toBe(true);

  });

  it('traces execution of getById', async () => {
    const tracer = getTracer();
    const span = tracer.startSpan('test-span');
    const result = await provider.getById({ id: { key: 'home-decor'}}, session);
    span.end();
    await shutdownOtel();
  });

});
