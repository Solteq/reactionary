import type { Cache, RequestContext } from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  MemoryCache,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoCategoryCapability } from '../capabilities/category.capability.js';
import { MagentoClient } from '../core/client.js';
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
 * Serves the Magento REST category endpoints from memory through a `fetch`
 * spy, so requests go through the real `MagentoClient` / `MagentoRest`. With
 * `supportsExternalId: false` it behaves like stock Magento: any filter on
 * `external_id` is rejected with HTTP 400.
 */
function fakeMagento(categories: MagentoCategory[], supportsExternalId: boolean) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const externalIdOf = (c: MagentoCategory) =>
    c.custom_attributes?.find((a) => a.attribute_code === 'external_id')?.value;
  const filterFields: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const byId = url.pathname.match(/\/V1\/categories\/(\d+)$/);
    if (byId) {
      const found = categories.find((c) => String(c.id) === byId[1]);
      return found ? json(found) : json({ message: 'No such entity.' }, 404);
    }

    const field = url.searchParams.get('searchCriteria[filterGroups][0][filters][0][field]') ?? '';
    const value = url.searchParams.get('searchCriteria[filterGroups][0][filters][0][value]') ?? '';
    filterFields.push(field);
    if (field === 'external_id' && !supportsExternalId) {
      return json(
        { message: 'The "%1" attribute name is invalid. Reset the name and try again.', parameters: ['external_id'] },
        400,
      );
    }
    const values = value.split(',');
    const items = categories.filter((c) => {
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
    });
    return json({ items, total_count: items.length });
  });

  return { filterFields };
}

function makeCapability(reqCtx: RequestContext, cache: Cache = new NoOpCache()) {
  return new MagentoCategoryCapability(
    config,
    cache,
    reqCtx,
    new MagentoClient(config, reqCtx),
    new MagentoCategoryFactory(CategorySchema, CategoryPaginatedResultSchema),
  );
}

const paginationOptions = { pageNumber: 1, pageSize: 20 };

describe('MagentoCategoryCapability', () => {
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('store with external_id', () => {
    let store: ReturnType<typeof fakeMagento>;
    let capability: MagentoCategoryCapability;

    beforeEach(() => {
      store = fakeMagento(
        [category(10, 2, '1010'), category(11, 10, '1011'), category(12, 11, '1012')],
        true,
      );
      capability = makeCapability(reqCtx);
    });

    it('resolves getById by external_id and keys the category and its parent by external_id', async () => {
      const result = await capability.getById({ id: { key: '1011' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('1011');
        expect(result.value.parentCategory?.key).toBe('1010');
      }
      expect(store.filterFields[0]).toBe('external_id');
    });

    it('never falls back to entity id when the key matches an external_id', async () => {
      await capability.getById({ id: { key: '1011' } });

      expect(store.filterFields).not.toContain('entity_id');
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
      fakeMagento([category(10, 2, '1010'), category(11, 10)], true);
      const capability = makeCapability(reqCtx);

      const result = await capability.getById({ id: { key: '11' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('11');
        expect(result.value.parentCategory?.key).toBe('1010');
      }
    });

    it('caches the external_id, not the entity-id key it was resolved by, as the category key', async () => {
      fakeMagento([category(10, 2, '1010'), category(11, 10, '1011'), category(12, 11, '1012')], true);
      const capability = makeCapability(reqCtx, new MemoryCache());

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
      fakeMagento([category(10, 2), category(11, 10, '1011')], true);
      const capability = makeCapability(reqCtx);

      const result = await capability.getById({ id: { key: '1011' } });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.identifier.key).toBe('1011');
        expect(result.value.parentCategory?.key).toBe('10');
      }
    });
  });

  describe('store without external_id (stock Magento)', () => {
    let store: ReturnType<typeof fakeMagento>;
    let capability: MagentoCategoryCapability;

    beforeEach(() => {
      store = fakeMagento([category(10, 2), category(11, 10), category(12, 11)], false);
      capability = makeCapability(reqCtx);
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
      expect(store.filterFields).not.toContain('entity_id');
    });

    it('returns NotFound, not a thrown 400, for child categories of a non-numeric key', async () => {
      const result = await capability.findChildCategories({
        parentId: { key: 'shoes' },
        paginationOptions,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'NotFound' });
      }
    });
  });

  describe('Magento.store.category.getByExternalId', () => {
    it('returns null on HTTP 400 when badRequestAsNoMatch is set', async () => {
      fakeMagento([category(10, 2)], false);
      const client = await new MagentoClient(config, reqCtx).getClient();

      await expect(client.store.category.getByExternalId('10', { badRequestAsNoMatch: true })).resolves.toBeNull();
    });

    it('still throws on HTTP 400 by default', async () => {
      fakeMagento([category(10, 2)], false);
      const client = await new MagentoClient(config, reqCtx).getClient();

      await expect(client.store.category.getByExternalId('10')).rejects.toThrow();
    });
  });
});
