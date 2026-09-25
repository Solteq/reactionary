import type { Cache, RequestContext } from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  MemoryCache,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoCategoryCapability } from '../capabilities/category.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoCategoryFactory } from '../factories/category/category.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCategory } from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeCode: 'default',
  authStoreCode: 'default',
};

function category(id: number, parentId: number, externalId?: string): MagentoCategory {
  const path = { 10: '1/2/10', 11: '1/2/10/11', 12: '1/2/10/11/12' }[id] ?? `1/2/${id}`;
  return {
    id,
    parent_id: parentId,
    name: `Category ${id}`,
    path,
    custom_attributes: [
      { attribute_code: 'url_key', value: `category-${id}` },
      ...(externalId === undefined ? [] : [{ attribute_code: 'external_id', value: externalId }]),
    ],
  };
}

/**
 * An in-memory stand-in for the Magento REST category endpoints. With
 * `supportsExternalId: false` it behaves like stock Magento: any filter on
 * `external_id` is rejected with HTTP 400, exactly as `MagentoRest.request`
 * surfaces it.
 */
function fakeStore(categories: MagentoCategory[], supportsExternalId: boolean) {
  const reject400 = () =>
    Promise.reject(
      new Error(
        'Magento request failed: GET https://example.com/rest/default/V1/categories/list?... → 400\n' +
          '{"message":"The \\"%1\\" attribute name is invalid. Reset the name and try again.","parameters":["external_id"]}',
      ),
    );
  const externalIdOf = (c: MagentoCategory) =>
    c.custom_attributes?.find((a) => a.attribute_code === 'external_id')?.value;

  const store = {
    getByExternalId: vi.fn((key: string) => {
      if (!supportsExternalId) return reject400();
      return Promise.resolve(categories.find((c) => externalIdOf(c) === key) ?? null);
    }),
    getById: vi.fn((id: string) => {
      const found = categories.find((c) => String(c.id) === id);
      return found
        ? Promise.resolve(structuredClone(found))
        : Promise.reject(new Error(`Magento request failed: GET /V1/categories/${id} → 404`));
    }),
    list: vi.fn((params: URLSearchParams) => {
      const field = params.get('searchCriteria[filterGroups][0][filters][0][field]');
      const value = params.get('searchCriteria[filterGroups][0][filters][0][value]') ?? '';
      if (field === 'external_id' && !supportsExternalId) return reject400();
      const values = value.split(',');
      const items = categories
        .filter((c) => {
          switch (field) {
            case 'entity_id':
              return values.includes(String(c.id));
            case 'parent_id':
              return String(c.parent_id) === value;
            case 'external_id':
              return externalIdOf(c) === value;
            default:
              return false;
          }
        })
        .map((c) => structuredClone(c));
      return Promise.resolve({ items, total_count: items.length });
    }),
  };
  return store;
}

function makeCapability(
  store: ReturnType<typeof fakeStore>,
  reqCtx: RequestContext,
  cache: Cache = new NoOpCache(),
) {
  const magentoApi = { getClient: async () => ({ store: { category: store } }) };
  return new MagentoCategoryCapability(
    config,
    cache,
    reqCtx,
    magentoApi as unknown as MagentoClient,
    new MagentoCategoryFactory(CategorySchema, CategoryPaginatedResultSchema),
  );
}

const paginationOptions = { pageNumber: 1, pageSize: 20 };

describe('MagentoCategoryCapability', () => {
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
  });

  describe('store with external_id', () => {
    let store: ReturnType<typeof fakeStore>;
    let capability: MagentoCategoryCapability;

    beforeEach(() => {
      store = fakeStore(
        [category(10, 2, '1010'), category(11, 10, '1011'), category(12, 11, '1012')],
        true,
      );
      capability = makeCapability(store, reqCtx);
    });

    it('resolves getById by external_id and keys the category and its parent by external_id', async () => {
      const result = await capability.getById({ id: { key: '1011' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('1011');
        expect(result.value.parentCategory?.key).toBe('1010');
      }
      expect(store.getByExternalId).toHaveBeenCalledWith('1011');
    });

    it('never falls back to entity id when the key matches an external_id', async () => {
      await capability.getById({ id: { key: '1011' } });

      const entityIdLookups = store.list.mock.calls.filter(
        ([p]) => p.get('searchCriteria[filterGroups][0][filters][0][field]') === 'entity_id',
      );
      expect(entityIdLookups).toHaveLength(0);
    });

    it('finds child categories by translating the external_id key to the entity id', async () => {
      const result = await capability.findChildCategories({
        parentId: { key: '1010' },
        paginationOptions,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.items.map((c) => c.identifier.key)).toEqual(['1011']);
        expect(result.value.items[0].parentCategory?.key).toBe('1010');
      }
    });

    it('builds the breadcrumb for an external_id key', async () => {
      const result = await capability.getBreadcrumbPathToCategory({ id: { key: '1012' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.map((c) => c.identifier.key)).toEqual(['1010', '1011', '1012']);
      }
    });
  });

  describe('store with external_id where a category has none set', () => {
    it('falls back to the entity id for a numeric key with no external_id match', async () => {
      const store = fakeStore([category(10, 2, '1010'), category(11, 10)], true);
      const capability = makeCapability(store, reqCtx);

      const result = await capability.getById({ id: { key: '11' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('11');
        expect(result.value.parentCategory?.key).toBe('1010');
      }
    });

    it('caches the external_id, not the entity-id key it was resolved by, as the category key', async () => {
      const store = fakeStore([category(10, 2, '1010'), category(11, 10, '1011'), category(12, 11, '1012')], true);
      const capability = makeCapability(store, reqCtx, new MemoryCache());

      const result = await capability.findChildCategories({
        parentId: { key: '11' },
        paginationOptions,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.items.map((c) => c.identifier.key)).toEqual(['1012']);
        expect(result.value.items[0].parentCategory?.key).toBe('1011');
      }
    });

    it('keys a parent without external_id by its entity id instead of "-"', async () => {
      const store = fakeStore([category(10, 2), category(11, 10, '1011')], true);
      const capability = makeCapability(store, reqCtx);

      const result = await capability.getById({ id: { key: '1011' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('1011');
        expect(result.value.parentCategory?.key).toBe('10');
      }
    });
  });

  describe('store without external_id (stock Magento)', () => {
    let store: ReturnType<typeof fakeStore>;
    let capability: MagentoCategoryCapability;

    beforeEach(() => {
      store = fakeStore([category(10, 2), category(11, 10), category(12, 11)], false);
      capability = makeCapability(store, reqCtx);
    });

    it('resolves getById for a numeric key after the external_id filter is rejected with 400', async () => {
      const result = await capability.getById({ id: { key: '11' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('11');
        expect(result.value.parentCategory?.key).toBe('10');
      }
    });

    it('emits numeric-string parent keys, never "-" or NaN', async () => {
      const result = await capability.findChildCategories({
        parentId: { key: '10' },
        paginationOptions,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0].identifier.key).toBe('11');
        expect(result.value.items[0].parentCategory?.key).toBe('10');
      }
    });

    it('builds the breadcrumb for an entity id key', async () => {
      const result = await capability.getBreadcrumbPathToCategory({ id: { key: '12' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.map((c) => c.identifier.key)).toEqual(['10', '11', '12']);
        expect(result.value.map((c) => c.parentCategory?.key)).toEqual([undefined, '10', '11']);
      }
    });

    it('returns NotFound for a non-numeric key instead of guessing an entity id', async () => {
      const result = await capability.getById({ id: { key: 'shoes' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'NotFound' });
      }
      const entityIdLookups = store.list.mock.calls.filter(
        ([p]) => p.get('searchCriteria[filterGroups][0][filters][0][field]') === 'entity_id',
      );
      expect(entityIdLookups).toHaveLength(0);
    });
  });
});
