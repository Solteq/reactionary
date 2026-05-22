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
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclProductListFactory } from '../factories/product-list/product-list.factory.js';
import type { HclProductListItemInput } from '../factories/product-list/product-list.factory.js';
import type {
  HclWishlist,
  HclWishlistItemResponse,
  HclWishlistListResponse,
  HclWishlistMutationResponse,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:product-list');

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
    debug('getById %s', payload.identifier.key);

    const response = await this.client.callGet<HclWishlistItemResponse>(
      this.getWishlistItemsUrl(payload.identifier.key),
      this.getWishlistItemsParams({
        search: {
          list: payload.identifier,
          paginationOptions: { pageSize: 100, pageNumber: 1 },
        },
      } as ProductListItemsQuery),
      { allowUndefined: true },
    );

    if (!response?.GiftList?.[0]) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const wishlist: HclWishlist = response.GiftList[0];
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

    const response = await this.client.callGet<HclWishlistListResponse>(
      this.getWishlistsUrl(),
      undefined,
      { allowUndefined: true },
    );

    const data: HclWishlistListResponse = response ?? {
      GiftList: [],
      recordSetTotal: '0',
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
    debug('addList name=%s', mutation.list.name);

    const response = await this.client.callPost<HclWishlistMutationResponse>(
      this.getWishlistsUrl(),
      this.getCreateWishlistBody(mutation),
    );

    const listId = response.uniqueID ?? response.externalIdentifier ?? '';

    // Re-fetch to get the full wishlist object (POST only returns uniqueID).
    const fetchedResponse = await this.client.callGet<HclWishlistItemResponse>(
      this.getWishlistItemsUrl(listId),
      this.getWishlistItemsParams({
        search: {
          list: { key: listId, listType: mutation.list.type },
          paginationOptions: { pageSize: 1, pageNumber: 1 },
        },
      } as ProductListItemsQuery),
      { allowUndefined: true },
    );

    if (fetchedResponse?.GiftList?.[0]) {
      return success(
        this.factory.parseProductList(
          this.context,
          fetchedResponse.GiftList[0],
        ),
      );
    }

    // Fall back to constructing a minimal wishlist from the create response.
    const wishlist: HclWishlist = {
      uniqueID: listId,
      externalIdentifier: response.externalIdentifier,
      descriptionName: mutation.list.name,
      description: mutation.list.description,
    };
    return success(this.factory.parseProductList(this.context, wishlist));
  }

  @Reactionary({
    inputSchema: ProductListMutationUpdateSchema,
    outputSchema: ProductListSchema,
  })
  public override async updateList(
    mutation: ProductListMutationUpdate,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    debug('updateList %s', mutation.list.key);

    await this.client.callPut<HclWishlistMutationResponse>(
      this.getWishlistUrl(mutation.list.key),
      this.getUpdateWishlistBody(mutation),
    );

    // Re-fetch updated wishlist.
    const response = await this.client.callGet<HclWishlistItemResponse>(
      this.getWishlistItemsUrl(mutation.list.key),
      this.getWishlistItemsParams({
        search: {
          list: mutation.list,
          paginationOptions: { pageSize: 1, pageNumber: 1 },
        },
      } as ProductListItemsQuery),
      { allowUndefined: true },
    );

    if (!response?.GiftList?.[0]) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: mutation.list,
      });
    }

    return success(
      this.factory.parseProductList(this.context, response.GiftList[0]),
    );
  }

  @Reactionary({
    inputSchema: ProductListMutationDeleteSchema,
  })
  public override async deleteList(
    mutation: ProductListMutationDelete,
  ): Promise<Result<void>> {
    debug('deleteList %s', mutation.list.key);

    await this.client.callDelete(this.getWishlistUrl(mutation.list.key), {
      ignore404: false,
    });

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
    debug('queryListItems list=%s', query.search.list.key);

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

    const params = this.getAddItemParams();
    const url = `${this.getWishlistUrl(mutation.list.key)}?${params.toString()}`;

    await this.client.callPut<HclWishlistMutationResponse>(
      url,
      this.getAddItemBody(mutation),
    );

    // WCS doesn't return the item directly — resolve by fetching current state
    // and returning the item matching the SKU.
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

    if (!item) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: { key: sku, list: mutation.list },
      });
    }

    const input: HclProductListItemInput = { item, list: mutation.list };
    return success(this.factory.parseProductListItem(this.context, input));
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

    // First, fetch the current item to get the SKU.
    const listResponse = await this.client.callGet<HclWishlistItemResponse>(
      this.getWishlistItemsUrl(mutation.listItem.list.key),
      this.getWishlistItemsParams({
        search: {
          list: mutation.listItem.list,
          paginationOptions: { pageSize: 100, pageNumber: 1 },
        },
      } as ProductListItemsQuery),
      { allowUndefined: true },
    );

    const existing = listResponse?.GiftList?.[0]?.item?.find(
      (i) => i.giftListItemID === mutation.listItem.key,
    );

    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: mutation.listItem,
      });
    }

    const params = this.getAddItemParams();
    const url = `${this.getWishlistUrl(mutation.listItem.list.key)}?${params.toString()}`;

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
      this.getWishlistItemsUrl(mutation.listItem.list.key),
      this.getWishlistItemsParams({
        search: {
          list: mutation.listItem.list,
          paginationOptions: { pageSize: 100, pageNumber: 1 },
        },
      } as ProductListItemsQuery),
      { allowUndefined: true },
    );

    const updatedItem = updated?.GiftList?.[0]?.item?.find(
      (i) => i.giftListItemID === mutation.listItem.key,
    );

    if (!updatedItem) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: mutation.listItem,
      });
    }

    const input: HclProductListItemInput = {
      item: updatedItem,
      list: mutation.listItem.list,
    };
    return success(this.factory.parseProductListItem(this.context, input));
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

    await this.client.callDelete(
      this.getWishlistItemUrl(
        mutation.listItem.list.key,
        mutation.listItem.key,
      ),
      { ignore404: true },
    );

    return success(undefined);
  }

  // ---------------------------------------------------------------------------
  // Extension points
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
      description: mutation.list.description ?? '',
      giftCardAccepted: 'false',
      accessSpecifier: 'Private',
    };
  }

  protected getUpdateWishlistBody(
    mutation: ProductListMutationUpdate,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (mutation.name !== undefined) body['descriptionName'] = mutation.name;
    if (mutation.description !== undefined)
      body['description'] = mutation.description;
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
}
