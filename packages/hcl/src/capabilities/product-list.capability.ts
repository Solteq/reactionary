import {
  type Cache,
  type NotFoundError,
  ProductListCapability,
  type ProductListFactory,
  type ProductListFactoryItemOutput,
  type ProductListFactoryItemPaginatedOutput,
  type ProductListFactoryListOutput,
  type ProductListFactoryListPaginatedOutput,
  type ProductListFactoryWithOutput,
  type ProductListItemMutationCreate,
  ProductListItemMutationCreateSchema,
  type ProductListItemMutationDelete,
  ProductListItemMutationDeleteSchema,
  type ProductListItemMutationUpdate,
  ProductListItemMutationUpdateSchema,
  ProductListItemPaginatedResultsSchema,
  ProductListItemQuerySchema,
  type ProductListItemsQuery,
  ProductListItemSchema,
  type ProductListMutationCreate,
  ProductListMutationCreateSchema,
  type ProductListMutationDelete,
  ProductListMutationDeleteSchema,
  type ProductListMutationUpdate,
  ProductListMutationUpdateSchema,
  ProductListPaginatedResultsSchema,
  type ProductListQuery,
  type ProductListQueryById,
  ProductListQueryByIdSchema,
  ProductListQuerySchema,
  ProductListSchema,
  type ProductListType,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type {
  HclProductListFactory,
  HclProductListItemInput,
  HclRequisitionListFactoryExtension,
  HclRequisitionListItemInput,
} from '../factories/product-list/product-list.factory.js';
import { encodeWishlistType } from '../factories/product-list/product-list.factory.js';
import type {
  HclRequisitionList,
  HclRequisitionListDetailResponse,
  HclRequisitionListMutationResponse,
  HclRequisitionListResponse,
  HclWishlist,
  HclWishlistItemResponse,
  HclWishlistListResponse,
  HclWishlistMutationResponse,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:product-list');

/** Returns true when this listType maps to the WCS Requisition List API. */
function isRequisitionList(listType: ProductListType): boolean {
  return listType === 'requisition';
}

export class HclProductListCapability<
  TFactory extends ProductListFactory = HclProductListFactory,
> extends ProductListCapability<
  ProductListFactoryListOutput<TFactory>,
  ProductListFactoryItemOutput<TFactory>,
  ProductListFactoryListPaginatedOutput<TFactory>,
  ProductListFactoryItemPaginatedOutput<TFactory>
> {
  protected readonly config: HclConfiguration;
  protected readonly client: HclClient;
  protected readonly factory: ProductListFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: ProductListFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  /**
   * Returns the factory cast to include the HCL-specific requisition list parse methods.
   * Subclasses can override this if they provide a custom factory.
   */
  protected get requisitionFactory(): ProductListFactoryWithOutput<TFactory> &
    HclRequisitionListFactoryExtension {
    return this.factory as ProductListFactoryWithOutput<TFactory> &
      HclRequisitionListFactoryExtension;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  @Reactionary({
    inputSchema: ProductListQueryByIdSchema,
    outputSchema: ProductListSchema,
  })
  public override async getById(
    payload: ProductListQueryById,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    debug(
      'getById %s (type=%s)',
      payload.identifier.key,
      payload.identifier.listType,
    );

    const itemsQuery: ProductListItemsQuery = {
      search: {
        list: payload.identifier,
        paginationOptions: { pageSize: 100, pageNumber: 1 },
      },
    };

    let wishlist: HclWishlist | undefined;

    if (isRequisitionList(payload.identifier.listType)) {
      const response =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(payload.identifier.key),
          this.getRequisitionListItemsParams(itemsQuery),
          { allowUndefined: true },
        );
      const raw = response?.resultList?.[0];
      if (!raw)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.identifier,
        });
      return success(
        this.requisitionFactory.parseRequisitionList(
          this.context,
          raw,
        ) as ProductListFactoryListOutput<TFactory>,
      );
    } else {
      const response = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(payload.identifier.key),
        this.getWishlistItemsParams(itemsQuery),
        { allowUndefined: true },
      );
      wishlist = response?.GiftList?.[0];
    }

    if (!wishlist) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    return success(this.factory.parseProductList(this.context, wishlist));
  }

  @Reactionary({
    inputSchema: ProductListQuerySchema,
    outputSchema: ProductListPaginatedResultsSchema,
  })
  public override async queryLists(
    query: ProductListQuery,
  ): Promise<Result<ProductListFactoryListPaginatedOutput<TFactory>>> {
    debug('queryLists listType=%s', query.search.listType);

    if (isRequisitionList(query.search.listType)) {
      const response = await this.client.callGet<HclRequisitionListResponse>(
        this.getRequisitionListsUrl(),
        undefined,
        { allowUndefined: true },
      );
      return success(
        this.requisitionFactory.parseRequisitionListPaginatedResult(
          this.context,
          response ?? {},
          query,
        ) as ProductListFactoryListPaginatedOutput<TFactory>,
      );
    }

    const response = await this.client.callGet<HclWishlistListResponse>(
      this.getWishlistsUrl(),
      undefined,
      { allowUndefined: true },
    );
    // HCL returns all wishlists regardless of type — filter client-side.
    const data: HclWishlistListResponse = {
      GiftList: response?.GiftList ?? [],
      recordSetTotal: response?.recordSetTotal ?? '0',
    };
    return success(
      this.factory.parseProductListPaginatedResult(this.context, data, query),
    );
  }

  // ---------------------------------------------------------------------------
  // List mutations
  // ---------------------------------------------------------------------------

  @Reactionary({
    inputSchema: ProductListMutationCreateSchema,
    outputSchema: ProductListSchema,
  })
  public override async addList(
    mutation: ProductListMutationCreate,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    debug('addList name=%s type=%s', mutation.list.name, mutation.list.type);

    let listId: string;

    if (isRequisitionList(mutation.list.type)) {
      const response =
        await this.client.callPost<HclRequisitionListMutationResponse>(
          this.getRequisitionListsUrl(),
          this.getCreateRequisitionListBody(mutation),
        );
      listId = response.requisitionListId ?? '';

      const fetchedResponse =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(listId),
          this.getRequisitionListItemsParams({
            search: {
              list: { key: listId, listType: mutation.list.type },
              paginationOptions: { pageSize: 1, pageNumber: 1 },
            },
          } as ProductListItemsQuery),
          { allowUndefined: true },
        );

      const raw: HclRequisitionList = fetchedResponse?.resultList?.[0] ?? {
        requisitionListId: listId,
        name: mutation.list.name,
        description: mutation.list.description,
      };
      return success(
        this.requisitionFactory.parseRequisitionList(
          this.context,
          raw,
        ) as ProductListFactoryListOutput<TFactory>,
      );
    } else {
      const response = await this.client.callPost<HclWishlistMutationResponse>(
        this.getWishlistsUrl(),
        this.getCreateWishlistBody(mutation),
      );
      listId = response.uniqueID ?? response.externalIdentifier ?? '';

      const fetchedResponse =
        await this.client.callGet<HclWishlistItemResponse>(
          this.getWishlistItemsUrl(listId),
          this.getWishlistItemsParams({
            search: {
              list: { key: listId, listType: mutation.list.type },
              paginationOptions: { pageSize: 1, pageNumber: 1 },
            },
          } as ProductListItemsQuery),
          { allowUndefined: true },
        );

      const wishlist: HclWishlist = fetchedResponse?.GiftList?.[0] ?? {
        uniqueID: listId,
        externalIdentifier: response.externalIdentifier,
        descriptionName: mutation.list.name,
        description: encodeWishlistType(mutation.list.type, mutation.list.description),
      };
      return success(this.factory.parseProductList(this.context, wishlist));
    }
  }

  @Reactionary({
    inputSchema: ProductListMutationUpdateSchema,
    outputSchema: ProductListSchema,
  })
  public override async updateList(
    mutation: ProductListMutationUpdate,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    debug('updateList %s (type=%s)', mutation.list.key, mutation.list.listType);

    const itemsQuery: ProductListItemsQuery = {
      search: {
        list: mutation.list,
        paginationOptions: { pageSize: 1, pageNumber: 1 },
      },
    };

    if (isRequisitionList(mutation.list.listType)) {
      await this.client.callPut<HclRequisitionListMutationResponse>(
        this.getRequisitionListUrl(mutation.list.key),
        this.getUpdateRequisitionListBody(mutation),
      );
      const response =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(mutation.list.key),
          this.getRequisitionListItemsParams(itemsQuery),
          { allowUndefined: true },
        );
      const raw = response?.resultList?.[0];
      if (!raw)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.list,
        });
      return success(
        this.requisitionFactory.parseRequisitionList(
          this.context,
          raw,
        ) as ProductListFactoryListOutput<TFactory>,
      );
    } else {
      await this.client.callPut<HclWishlistMutationResponse>(
        this.getWishlistUrl(mutation.list.key),
        this.getUpdateWishlistBody(mutation),
      );
      const response = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(mutation.list.key),
        this.getWishlistItemsParams(itemsQuery),
        { allowUndefined: true },
      );
      if (!response?.GiftList?.[0])
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.list,
        });
      return success(
        this.factory.parseProductList(this.context, response.GiftList[0]),
      );
    }
  }

  @Reactionary({
    inputSchema: ProductListMutationDeleteSchema,
  })
  public override async deleteList(
    mutation: ProductListMutationDelete,
  ): Promise<Result<void>> {
    debug('deleteList %s (type=%s)', mutation.list.key, mutation.list.listType);

    if (isRequisitionList(mutation.list.listType)) {
      await this.client.callDelete(
        this.getRequisitionListUrl(mutation.list.key),
        { ignore404: false },
      );
    } else {
      await this.client.callDelete(this.getWishlistUrl(mutation.list.key), {
        ignore404: false,
      });
    }

    return success(undefined);
  }

  // ---------------------------------------------------------------------------
  // Item queries / mutations
  // ---------------------------------------------------------------------------

  @Reactionary({
    inputSchema: ProductListItemQuerySchema,
    outputSchema: ProductListItemPaginatedResultsSchema,
  })
  public override async queryListItems(
    query: ProductListItemsQuery,
  ): Promise<Result<ProductListFactoryItemPaginatedOutput<TFactory>>> {
    debug(
      'queryListItems list=%s (type=%s)',
      query.search.list.key,
      query.search.list.listType,
    );

    if (isRequisitionList(query.search.list.listType)) {
      const response =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(query.search.list.key),
          this.getRequisitionListItemsParams(query),
          { allowUndefined: true },
        );
      return success(
        this.requisitionFactory.parseRequisitionListItemPaginatedResult(
          this.context,
          response ?? {},
          query,
        ) as ProductListFactoryItemPaginatedOutput<TFactory>,
      );
    } else {
      const response = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(query.search.list.key),
        this.getWishlistItemsParams(query),
        { allowUndefined: true },
      );
      const data: HclWishlistItemResponse = response ?? {
        GiftList: [],
        recordSetTotal: '0',
      };
      return success(
        this.factory.parseProductListItemPaginatedResult(
          this.context,
          data,
          query,
        ),
      );
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationCreateSchema,
    outputSchema: ProductListItemSchema,
  })
  public override async addItem(
    mutation: ProductListItemMutationCreate,
  ): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    debug(
      'addItem list=%s sku=%s',
      mutation.list.key,
      mutation.listItem.variant.sku,
    );

    if (isRequisitionList(mutation.list.listType)) {
      const params = this.getRequisitionAddItemParams();
      const url = `${this.getRequisitionListUrl(mutation.list.key)}?${params.toString()}`;
      await this.client.callPut<HclRequisitionListMutationResponse>(
        url,
        this.getRequisitionAddItemBody(mutation),
      );

      const response =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(mutation.list.key),
          this.getRequisitionListItemsParams({
            search: {
              list: mutation.list,
              paginationOptions: { pageSize: 100, pageNumber: 1 },
            },
          } as ProductListItemsQuery),
          { allowUndefined: true },
        );
      const sku = mutation.listItem.variant.sku;
      const raw = response?.resultList?.[0]?.item?.find(
        (i) => i.productId === sku || i.partNumber === sku,
      );
      if (!raw)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: { key: sku, list: mutation.list },
        });
      const input: HclRequisitionListItemInput = {
        item: raw,
        list: mutation.list,
      };
      return success(
        this.requisitionFactory.parseRequisitionListItem(
          this.context,
          input,
        ) as ProductListFactoryItemOutput<TFactory>,
      );
    } else {
      const params = this.getAddItemParams();
      const url = `${this.getWishlistUrl(mutation.list.key)}?${params.toString()}`;
      await this.client.callPut<HclWishlistMutationResponse>(
        url,
        this.getAddItemBody(mutation),
      );

      const listResponse = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(mutation.list.key),
        this.getWishlistItemsParams({
          search: {
            list: mutation.list,
            paginationOptions: { pageSize: 100, pageNumber: 1 },
          },
        } as ProductListItemsQuery),
        { allowUndefined: true },
      );
      const sku = mutation.listItem.variant.sku;
      const item = listResponse?.GiftList?.[0]?.item?.find(
        (i) => i.productId === sku || i.partNumber === sku,
      );
      if (!item)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: { key: sku, list: mutation.list },
        });
      const input: HclProductListItemInput = { item, list: mutation.list };
      return success(this.factory.parseProductListItem(this.context, input));
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationUpdateSchema,
    outputSchema: ProductListItemSchema,
  })
  public override async updateItem(
    mutation: ProductListItemMutationUpdate,
  ): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    debug(
      'updateItem list=%s item=%s',
      mutation.listItem.list.key,
      mutation.listItem.key,
    );

    const listType = mutation.listItem.list.listType;
    const listId = mutation.listItem.list.key;
    const fetchQuery: ProductListItemsQuery = {
      search: {
        list: mutation.listItem.list,
        paginationOptions: { pageSize: 100, pageNumber: 1 },
      },
    };

    if (isRequisitionList(listType)) {
      const response =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(listId),
          this.getRequisitionListItemsParams(fetchQuery),
          { allowUndefined: true },
        );
      const existing = response?.resultList?.[0]?.item?.find(
        (i) => i.requisitionListItemId === mutation.listItem.key,
      );
      if (!existing)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.listItem,
        });

      const params = this.getRequisitionAddItemParams();
      const url = `${this.getRequisitionListUrl(listId)}?${params.toString()}`;
      await this.client.callPut<HclRequisitionListMutationResponse>(url, {
        item: [
          {
            location: 'online',
            productId: existing.productId ?? existing.partNumber,
            quantity: String(
              mutation.quantity ?? Number(existing.quantity ?? 1),
            ),
          },
        ],
      });

      const updated =
        await this.client.callGet<HclRequisitionListDetailResponse>(
          this.getRequisitionListItemsUrl(listId),
          this.getRequisitionListItemsParams(fetchQuery),
          { allowUndefined: true },
        );
      const updatedRaw = updated?.resultList?.[0]?.item?.find(
        (i) => i.requisitionListItemId === mutation.listItem.key,
      );
      if (!updatedRaw)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.listItem,
        });
      const input: HclRequisitionListItemInput = {
        item: updatedRaw,
        list: mutation.listItem.list,
      };
      return success(
        this.requisitionFactory.parseRequisitionListItem(
          this.context,
          input,
        ) as ProductListFactoryItemOutput<TFactory>,
      );
    } else {
      const listResponse = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(listId),
        this.getWishlistItemsParams(fetchQuery),
        { allowUndefined: true },
      );
      const existing = listResponse?.GiftList?.[0]?.item?.find(
        (i) => i.giftListItemID === mutation.listItem.key,
      );
      if (!existing)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.listItem,
        });

      const params = this.getAddItemParams();
      const url = `${this.getWishlistUrl(listId)}?${params.toString()}`;
      await this.client.callPut<HclWishlistMutationResponse>(url, {
        item: [
          {
            location: 'online',
            productId: existing.productId ?? existing.partNumber,
            quantityRequested: String(
              mutation.quantity ?? Number(existing.quantityRequested ?? 1),
            ),
          },
        ],
      });

      const updated = await this.client.callGet<HclWishlistItemResponse>(
        this.getWishlistItemsUrl(listId),
        this.getWishlistItemsParams(fetchQuery),
        { allowUndefined: true },
      );
      const updatedItem = updated?.GiftList?.[0]?.item?.find(
        (i) => i.giftListItemID === mutation.listItem.key,
      );
      if (!updatedItem)
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: mutation.listItem,
        });
      const input: HclProductListItemInput = {
        item: updatedItem,
        list: mutation.listItem.list,
      };
      return success(this.factory.parseProductListItem(this.context, input));
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationDeleteSchema,
  })
  public override async deleteItem(
    mutation: ProductListItemMutationDelete,
  ): Promise<Result<void>> {
    debug(
      'deleteItem list=%s item=%s',
      mutation.listItem.list.key,
      mutation.listItem.key,
    );

    if (isRequisitionList(mutation.listItem.list.listType)) {
      await this.client.callDelete(
        this.getRequisitionListItemUrl(
          mutation.listItem.list.key,
          mutation.listItem.key,
        ),
        { ignore404: true },
      );
    } else {
      await this.client.callDelete(
        this.getWishlistItemUrl(
          mutation.listItem.list.key,
          mutation.listItem.key,
        ),
        { ignore404: true },
      );
    }

    return success(undefined);
  }

  // ---------------------------------------------------------------------------
  // Extension points — wishlist (non-requisition)
  // ---------------------------------------------------------------------------

  protected getWishlistsUrl(): string {
    return `${this.client.transactionBaseUrl}/wishlist`;
  }

  protected getWishlistUrl(listId: string): string {
    return `${this.client.transactionBaseUrl}/wishlist/${encodeURIComponent(listId)}`;
  }

  protected getWishlistItemsUrl(listId: string): string {
    return `${this.client.transactionBaseUrl}/wishlist/${encodeURIComponent(listId)}/item`;
  }

  protected getWishlistItemUrl(listId: string, itemId: string): string {
    return `${this.client.transactionBaseUrl}/wishlist/${encodeURIComponent(listId)}/item/${encodeURIComponent(itemId)}`;
  }

  protected getWishlistItemsParams(
    query: ProductListItemsQuery,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('pageNumber', String(query.search.paginationOptions.pageNumber));
    params.set('pageSize', String(query.search.paginationOptions.pageSize));
    return params;
  }

  protected getCreateWishlistBody(
    mutation: ProductListMutationCreate,
  ): Record<string, unknown> {
    return {
      descriptionName: mutation.list.name,
      // Encode the listType into description so it can be read back on query.
      description: encodeWishlistType(mutation.list.type, mutation.list.description),
      giftCardAccepted: 'false',
      accessSpecifier: 'Private',
    };
  }

  protected getUpdateWishlistBody(
    mutation: ProductListMutationUpdate,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (mutation.name !== undefined) body['descriptionName'] = mutation.name;
    if (mutation.description !== undefined) {
      // Re-encode the listType alongside the updated description.
      body['description'] = encodeWishlistType(
        mutation.list.listType,
        mutation.description,
      );
    }
    return body;
  }

  protected getAddItemParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('addItem', 'true');
    return params;
  }

  protected getAddItemBody(
    mutation: ProductListItemMutationCreate,
  ): Record<string, unknown> {
    return {
      item: [
        {
          location: 'online',
          productId: mutation.listItem.variant.sku,
          quantityRequested: String(mutation.listItem.quantity ?? 1),
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Extension points — requisition list
  // ---------------------------------------------------------------------------

  protected getRequisitionListsUrl(): string {
    return `${this.client.transactionBaseUrl}/requisitionList`;
  }

  protected getRequisitionListUrl(listId: string): string {
    return `${this.client.transactionBaseUrl}/requisitionList/${encodeURIComponent(listId)}`;
  }

  protected getRequisitionListItemsUrl(listId: string): string {
    return `${this.client.transactionBaseUrl}/requisitionList/${encodeURIComponent(listId)}`;
  }

  protected getRequisitionListItemUrl(listId: string, itemId: string): string {
    return `${this.client.transactionBaseUrl}/requisitionList/${encodeURIComponent(listId)}/requisitionListItem/${encodeURIComponent(itemId)}`;
  }

  protected getRequisitionListItemsParams(
    query: ProductListItemsQuery,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('pageNumber', String(query.search.paginationOptions.pageNumber));
    params.set('pageSize', String(query.search.paginationOptions.pageSize));
    return params;
  }

  protected getCreateRequisitionListBody(
    mutation: ProductListMutationCreate,
  ): Record<string, unknown> {
    return {
      name: mutation.list.name,
      description: mutation.list.description ?? '',
    };
  }

  protected getUpdateRequisitionListBody(
    mutation: ProductListMutationUpdate,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (mutation.name !== undefined) body['name'] = mutation.name;
    if (mutation.description !== undefined)
      body['description'] = mutation.description;
    return body;
  }

  protected getRequisitionAddItemParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('addItem', 'true');
    return params;
  }

  protected getRequisitionAddItemBody(
    mutation: ProductListItemMutationCreate,
  ): Record<string, unknown> {
    return {
      item: [
        {
          location: 'online',
          productId: mutation.listItem.variant.sku,
          quantity: String(mutation.listItem.quantity ?? 1),
        },
      ],
    };
  }
}
