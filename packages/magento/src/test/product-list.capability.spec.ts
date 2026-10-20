import type { ProductListIdentifier, RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListPaginatedResultsSchema,
  ProductListSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoProductListCapability } from '../capabilities/product-list.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoProductListFactory } from '../factories/product-list/product-list.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const WISHLIST = { id: '5', name: 'Summer', visibility: 'PUBLIC', items_count: 2, updated_at: '2026-01-01' };
const WISHLIST_ITEMS = [
  { id: '11', quantity: 1, description: 'gift', product: { sku: 'SKU-1' } },
  { id: '12', quantity: 2, description: null, product: { sku: 'PARENT' }, configured_variant: { sku: 'CHILD-RED' } },
];
const REQ_LIST = { uid: 'UQ==', name: 'Monthly', description: 'Office supplies', items_count: 1 };
const REQ_ITEMS = [{ uid: 'MTA=', quantity: 4, product: { sku: 'PAPER' } }];

const wishListId: ProductListIdentifier = { listType: 'wish', key: '5' };
const reqListId: ProductListIdentifier = { listType: 'requisition', key: 'UQ==' };

function operation(document: string): string {
  const match = /(query|mutation)\s+(\w+)/.exec(document);
  return match ? match[2] : '';
}

describe('MagentoProductListCapability', () => {
  let reqCtx: RequestContext;
  let magentoApi: { graphqlRequest: ReturnType<typeof vi.fn> };
  let responses: Record<string, unknown>;
  let capability: MagentoProductListCapability;

  function calls(name: string) {
    return magentoApi.graphqlRequest.mock.calls.filter(([doc]) => operation(String(doc)) === name);
  }

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    reqCtx.session.identityContext.identity = { type: 'Registered', id: { userId: '7' } };
    responses = {
      ReactionaryCustomerWishlists: { customer: { wishlists: [WISHLIST] } },
      ReactionaryCustomerWishlist: { customer: { wishlist_v2: WISHLIST } },
      ReactionaryCustomerWishlistItems: {
        customer: { wishlist_v2: { ...WISHLIST, items_v2: { items: WISHLIST_ITEMS, page_info: { total_pages: 1 } } } },
      },
      ReactionaryCustomerRequisitionLists: {
        customer: { requisition_lists: { items: [REQ_LIST], total_count: 3 } },
      },
      ReactionaryCustomerRequisitionListItems: {
        customer: { requisition_lists: { items: [{ ...REQ_LIST, items: { items: REQ_ITEMS, total_pages: 1 } }] } },
      },
      ReactionaryCreateWishlist: { createWishlist: { wishlist: { ...WISHLIST, id: '6', name: 'New', visibility: 'PRIVATE' } } },
      ReactionaryUpdateWishlist: { updateWishlist: { uid: '5', name: 'Summer', visibility: 'PUBLIC' } },
      ReactionaryDeleteWishlist: { deleteWishlist: { status: true } },
      ReactionaryAddProductsToWishlist: { addProductsToWishlist: { wishlist: { id: '5' }, user_errors: [] } },
      ReactionaryUpdateProductsInWishlist: { updateProductsInWishlist: { wishlist: { id: '5' }, user_errors: [] } },
      ReactionaryRemoveProductsFromWishlist: { removeProductsFromWishlist: { wishlist: { id: '5' }, user_errors: [] } },
      ReactionaryCreateRequisitionList: { createRequisitionList: { requisition_list: REQ_LIST } },
      ReactionaryUpdateRequisitionList: { updateRequisitionList: { requisition_list: { ...REQ_LIST, name: 'Weekly' } } },
      ReactionaryDeleteRequisitionList: { deleteRequisitionList: { status: true } },
      ReactionaryAddProductsToRequisitionList: { addProductsToRequisitionList: { requisition_list: { uid: 'UQ==' } } },
      ReactionaryUpdateRequisitionListItems: { updateRequisitionListItems: { requisition_list: { uid: 'UQ==' } } },
      ReactionaryDeleteRequisitionListItems: { deleteRequisitionListItems: { requisition_list: { uid: 'UQ==' } } },
      ReactionaryAddRequisitionListItemsToCart: {
        addRequisitionListItemsToCart: { status: true, add_requisition_list_items_to_cart_user_errors: [], cart: { id: 'masked' } },
      },
      ReactionaryCustomerCartId: { customerCart: { id: 'masked' } },
    };
    magentoApi = {
      graphqlRequest: vi.fn(async (document: string) => {
        const name = operation(document);
        if (!(name in responses)) {
          throw new Error(`unexpected operation ${name}`);
        }
        return responses[name];
      }),
    };
    capability = new MagentoProductListCapability(
      config,
      new NoOpCache(),
      reqCtx,
      magentoApi as unknown as MagentoClient,
      new MagentoProductListFactory(
        ProductListSchema,
        ProductListItemSchema,
        ProductListPaginatedResultsSchema,
        ProductListItemPaginatedResultsSchema,
      ),
    );
  });

  describe('access', () => {
    it('rejects the shopping list type', async () => {
      const result = await capability.queryLists({
        search: { listType: 'shopping', paginationOptions: { pageNumber: 1, pageSize: 10 } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('InvalidInput');
      }
    });

    it('gives guests no lists and rejects their writes', async () => {
      reqCtx.session.identityContext.identity = { type: 'Anonymous' };

      const lists = await capability.queryLists({
        search: { listType: 'wish', paginationOptions: { pageNumber: 1, pageSize: 10 } },
      });
      expect(lists.success && lists.value.totalCount).toBe(0);

      const byId = await capability.getById({ identifier: wishListId });
      expect(!byId.success && byId.error.type).toBe('NotFound');

      const add = await capability.addList({ list: { type: 'wish', name: 'x', published: false } });
      expect(!add.success && add.error.type).toBe('InvalidInput');
      expect(magentoApi.graphqlRequest).not.toHaveBeenCalled();
    });
  });

  describe('wishlists', () => {
    it('queries wishlists as favorite lists too', async () => {
      const result = await capability.queryLists({
        search: { listType: 'favorite', paginationOptions: { pageNumber: 1, pageSize: 10 } },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalCount).toBe(1);
        expect(result.value.items[0]).toMatchObject({
          identifier: { listType: 'favorite', key: '5', user: { userId: '7' } },
          type: 'favorite',
          name: 'Summer',
          published: true,
        });
      }
    });

    it('returns NotFound when the wishlist is not the customer\'s', async () => {
      responses['ReactionaryCustomerWishlist'] = { customer: { wishlist_v2: null } };
      const result = await capability.getById({ identifier: wishListId });
      expect(!result.success && result.error.type).toBe('NotFound');
    });

    it('creates a wishlist with visibility from published', async () => {
      const result = await capability.addList({ list: { type: 'wish', name: 'New', published: false } });
      expect(calls('ReactionaryCreateWishlist')[0][1]).toEqual({ input: { name: 'New', visibility: 'PRIVATE' } });
      expect(result.success && result.value.published).toBe(false);
    });

    it('updates name/visibility and re-reads the wishlist', async () => {
      const result = await capability.updateList({ list: wishListId, name: 'Summer', published: true });
      expect(calls('ReactionaryUpdateWishlist')[0][1]).toEqual({ wishlistId: '5', name: 'Summer', visibility: 'PUBLIC' });
      expect(result.success && result.value.name).toBe('Summer');
    });

    it('maps items with variant sku, notes and position order', async () => {
      const result = await capability.queryListItems({
        search: { list: wishListId, paginationOptions: { pageNumber: 1, pageSize: 10 } },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalCount).toBe(2);
        expect(result.value.items.map((i) => [i.identifier.key, i.variant.sku, i.notes, i.order])).toEqual([
          ['11', 'SKU-1', 'gift', 1],
          ['12', 'CHILD-RED', undefined, 2],
        ]);
      }
    });

    it('adds an item, sets its notes and returns it', async () => {
      const result = await capability.addItem({
        list: wishListId,
        listItem: { variant: { sku: 'SKU-1' }, quantity: 1, notes: 'birthday', order: 1 },
      });
      expect(calls('ReactionaryAddProductsToWishlist')[0][1]).toEqual({
        wishlistId: '5',
        wishlistItems: [{ sku: 'SKU-1', quantity: 1 }],
      });
      expect(calls('ReactionaryUpdateProductsInWishlist')[0][1]).toEqual({
        wishlistId: '5',
        wishlistItems: [{ wishlist_item_id: '11', description: 'birthday' }],
      });
      expect(result.success && result.value.notes).toBe('birthday');
    });

    it('turns wishlist user errors into InvalidInput', async () => {
      responses['ReactionaryAddProductsToWishlist'] = {
        addProductsToWishlist: { wishlist: { id: '5' }, user_errors: [{ code: 'PRODUCT_NOT_FOUND', message: 'No such SKU' }] },
      };
      const result = await capability.addItem({
        list: wishListId,
        listItem: { variant: { sku: 'NOPE' }, quantity: 1, order: 1 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatchObject({ type: 'InvalidInput', error: 'No such SKU' });
      }
    });

    it('updates quantity and notes of an item', async () => {
      const result = await capability.updateItem({
        listItem: { key: '12', list: wishListId },
        quantity: 3,
        notes: 'later',
      });
      expect(calls('ReactionaryUpdateProductsInWishlist')[0][1]).toEqual({
        wishlistId: '5',
        wishlistItems: [{ wishlist_item_id: '12', quantity: 3, description: 'later' }],
      });
      expect(result.success && result.value.identifier.key).toBe('12');
    });

    it('removes an item and deletes the list', async () => {
      const item = await capability.deleteItem({ listItem: { key: '11', list: wishListId } });
      expect(item.success).toBe(true);
      expect(calls('ReactionaryRemoveProductsFromWishlist')[0][1]).toEqual({ wishlistId: '5', wishlistItemsIds: ['11'] });

      const list = await capability.deleteList({ list: wishListId });
      expect(list.success).toBe(true);
    });

    it('reports a refused delete as an error', async () => {
      responses['ReactionaryDeleteWishlist'] = { deleteWishlist: { status: false } };
      const result = await capability.deleteList({ list: wishListId });
      expect(!result.success && result.error.type).toBe('Generic');
    });
  });

  describe('requisition lists', () => {
    it('queries requisition lists with server-side paging', async () => {
      const result = await capability.queryLists({
        search: { listType: 'requisition', paginationOptions: { pageNumber: 2, pageSize: 1 } },
      });
      expect(calls('ReactionaryCustomerRequisitionLists')[0][1]).toEqual({ pageSize: 1, currentPage: 2 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalCount).toBe(3);
        expect(result.value.items[0]).toMatchObject({
          identifier: { listType: 'requisition', key: 'UQ==' },
          name: 'Monthly',
          description: 'Office supplies',
          published: false,
        });
      }
    });

    it('gets a requisition list by uid', async () => {
      const result = await capability.getById({ identifier: reqListId });
      expect(calls('ReactionaryCustomerRequisitionLists')[0][1]).toEqual({
        pageSize: 1,
        currentPage: 1,
        filter: { uids: { eq: 'UQ==' } },
      });
      expect(result.success && result.value.name).toBe('Monthly');
    });

    it('keeps the current name when only the description changes', async () => {
      const result = await capability.updateList({ list: reqListId, description: 'New' });
      expect(calls('ReactionaryUpdateRequisitionList')[0][1]).toEqual({
        requisitionListUid: 'UQ==',
        input: { name: 'Monthly', description: 'New' },
      });
      expect(result.success).toBe(true);
    });

    it('adds and updates items', async () => {
      const added = await capability.addItem({
        list: reqListId,
        listItem: { variant: { sku: 'PAPER' }, quantity: 4, order: 1 },
      });
      expect(added.success && added.value.identifier.key).toBe('MTA=');

      const updated = await capability.updateItem({ listItem: { key: 'MTA=', list: reqListId }, quantity: 4 });
      expect(calls('ReactionaryUpdateRequisitionListItems')[0][1]).toEqual({
        requisitionListUid: 'UQ==',
        requisitionListItems: [{ item_id: 'MTA=', quantity: 4 }],
      });
      expect(updated.success && updated.value.quantity).toBe(4);
    });

    it('returns NotFound for an unknown item', async () => {
      const result = await capability.updateItem({ listItem: { key: 'nope', list: reqListId }, quantity: 1 });
      expect(!result.success && result.error.type).toBe('NotFound');
    });

    it('adds a requisition list to the customer cart', async () => {
      const result = await capability.addListToCart({ list: reqListId, cart: { key: 'masked' } });
      expect(result.success && result.value.key).toBe('masked');

      const mismatch = await capability.addListToCart({ list: reqListId, cart: { key: 'other' } });
      expect(!mismatch.success && mismatch.error.type).toBe('InvalidInput');

      const wish = await capability.addListToCart({ list: wishListId });
      expect(!wish.success && wish.error.type).toBe('InvalidInput');
    });
  });

  it('maps Magento failures to typed errors', async () => {
    magentoApi.graphqlRequest.mockRejectedValue(new Error('boom'));
    const result = await capability.getById({ identifier: wishListId });
    expect(!result.success && result.error.type).toBe('Generic');
  });
});
