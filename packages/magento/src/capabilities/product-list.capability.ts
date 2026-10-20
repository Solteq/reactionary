import type {
  Cache,
  CartIdentifier,
  InvalidInputError,
  NotFoundError,
  ProductListFactory,
  ProductListFactoryItemOutput,
  ProductListFactoryItemPaginatedOutput,
  ProductListFactoryListOutput,
  ProductListFactoryListPaginatedOutput,
  ProductListFactoryWithOutput,
  ProductListIdentifier,
  ProductListItemMutationCreate,
  ProductListItemMutationDelete,
  ProductListItemMutationUpdate,
  ProductListItemsQuery,
  ProductListMutationCreate,
  ProductListMutationDelete,
  ProductListMutationUpdate,
  ProductListQuery,
  ProductListQueryById,
  ProductListType,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  CartIdentifierSchema,
  ProductListCapability,
  ProductListItemMutationCreateSchema,
  ProductListItemMutationDeleteSchema,
  ProductListItemMutationUpdateSchema,
  ProductListItemPaginatedResultsSchema,
  ProductListItemQuerySchema,
  ProductListItemSchema,
  ProductListMutationCreateSchema,
  ProductListMutationDeleteSchema,
  ProductListMutationUpdateSchema,
  ProductListPaginatedResultsSchema,
  ProductListQueryByIdSchema,
  ProductListQuerySchema,
  ProductListSchema,
  Reactionary,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import {
  ADD_PRODUCTS_TO_REQUISITION_LIST_MUTATION,
  ADD_PRODUCTS_TO_WISHLIST_MUTATION,
  ADD_REQUISITION_LIST_ITEMS_TO_CART_MUTATION,
  CREATE_REQUISITION_LIST_MUTATION,
  CREATE_WISHLIST_MUTATION,
  CUSTOMER_CART_ID_QUERY,
  CUSTOMER_REQUISITION_LISTS_QUERY,
  CUSTOMER_REQUISITION_LIST_ITEMS_QUERY,
  CUSTOMER_WISHLISTS_QUERY,
  CUSTOMER_WISHLIST_ITEMS_QUERY,
  CUSTOMER_WISHLIST_QUERY,
  DELETE_REQUISITION_LIST_ITEMS_MUTATION,
  DELETE_REQUISITION_LIST_MUTATION,
  DELETE_WISHLIST_MUTATION,
  REMOVE_PRODUCTS_FROM_WISHLIST_MUTATION,
  UPDATE_PRODUCTS_IN_WISHLIST_MUTATION,
  UPDATE_REQUISITION_LIST_ITEMS_MUTATION,
  UPDATE_REQUISITION_LIST_MUTATION,
  UPDATE_WISHLIST_MUTATION,
} from '../core/product-list.graphql.js';
import type { MagentoProductListFactory } from '../factories/product-list/product-list.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import {
  MagentoAddProductsToRequisitionListResponseSchema,
  MagentoAddProductsToWishlistResponseSchema,
  MagentoAddRequisitionListItemsToCartResponseSchema,
  MagentoCreateRequisitionListResponseSchema,
  MagentoCreateWishlistResponseSchema,
  MagentoCustomerCartIdResponseSchema,
  MagentoCustomerRequisitionListsResponseSchema,
  MagentoCustomerWishlistResponseSchema,
  MagentoCustomerWishlistsResponseSchema,
  MagentoDeleteRequisitionListItemsResponseSchema,
  MagentoDeleteRequisitionListResponseSchema,
  MagentoDeleteWishlistResponseSchema,
  MagentoProductListAddToCartSchema,
  MagentoRemoveProductsFromWishlistResponseSchema,
  MagentoUpdateProductsInWishlistResponseSchema,
  MagentoUpdateRequisitionListItemsResponseSchema,
  MagentoUpdateRequisitionListResponseSchema,
  MagentoUpdateWishlistResponseSchema,
  type MagentoProductListAddToCart,
  type MagentoProductListItemSource,
  type MagentoProductListSource,
  type MagentoRequisitionList,
  type MagentoUserError,
  type MagentoWishlist,
} from '../schema/product-list.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:product-list');

/** How a core list type is stored in Magento. */
export type MagentoProductListKind = 'wishlist' | 'requisition';

/**
 * Product lists on Magento:
 * - `wish` and `favorite` → customer wishlists (several per customer, with
 *   name and visibility, on Adobe Commerce);
 * - `requisition` → Adobe Commerce B2B requisition lists;
 * - `shopping` → no Magento equivalent; rejected as invalid input.
 *
 * Lists belong to the signed-in customer: every call goes through the
 * storefront GraphQL API with the customer token, and Magento only ever
 * returns the token owner's lists. Guests get an empty `queryLists`, a
 * `NotFound` on reads and `InvalidInput` on writes.
 */
export class MagentoProductListCapability<
  TFactory extends ProductListFactory = MagentoProductListFactory,
> extends ProductListCapability<
  ProductListFactoryListOutput<TFactory>,
  ProductListFactoryItemOutput<TFactory>,
  ProductListFactoryListPaginatedOutput<TFactory>,
  ProductListFactoryItemPaginatedOutput<TFactory>
> {
  protected config: MagentoConfiguration;
  protected factory: ProductListFactoryWithOutput<TFactory>;

  /** Page size used when walking a whole list (wishlists, list items). */
  protected fetchAllPageSize = 50;
  /** Upper bound on the pages walked, so a misbehaving API can't loop forever. */
  protected fetchAllMaxPages = 40;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductListFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  // --- helpers ------------------------------------------------------------------

  /** Maps a core list type onto its Magento storage, or undefined when there is none. */
  protected resolveKind(listType: ProductListType): MagentoProductListKind | undefined {
    switch (listType) {
      case 'wish':
      case 'favorite':
        return 'wishlist';
      case 'requisition':
        return 'requisition';
      default:
        return undefined;
    }
  }

  protected unsupportedListType(listType: ProductListType) {
    return error<InvalidInputError>({
      type: 'InvalidInput',
      error: `Product list type '${listType}' is not supported by the Magento provider`,
    });
  }

  protected notRegistered() {
    return error<InvalidInputError>({
      type: 'InvalidInput',
      error: 'Only registered customers can have product lists',
    });
  }

  protected isRegistered(): boolean {
    return this.context.session.identityContext?.identity?.type === 'Registered';
  }

  protected currentUserId(): string | undefined {
    const identity = this.context.session.identityContext?.identity;
    return identity?.type === 'Registered' ? identity.id.userId : undefined;
  }

  /** A storefront GraphQL call whose response is validated against `schema`. */
  protected async gql<TSchema extends z.ZodType>(
    schema: TSchema,
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<z.output<TSchema>> {
    const data = await this.magentoApi.graphqlRequest<unknown>(document, variables);
    return schema.parse(data);
  }

  protected userErrorsFailure(errors: MagentoUserError[] | null | undefined) {
    if (!errors || errors.length === 0) {
      return undefined;
    }
    return error<InvalidInputError>({
      type: 'InvalidInput',
      error: errors.map((e) => e.message).join('; '),
    });
  }

  protected wishlistSource(
    listType: ProductListType,
    wishlist: MagentoWishlist,
  ): MagentoProductListSource {
    return { kind: 'wishlist', listType, userId: this.currentUserId(), wishlist };
  }

  protected requisitionSource(requisitionList: MagentoRequisitionList): MagentoProductListSource {
    return { kind: 'requisition', userId: this.currentUserId(), requisitionList };
  }

  protected async fetchWishlist(id: string): Promise<MagentoWishlist | undefined> {
    const data = await this.gql(MagentoCustomerWishlistResponseSchema, CUSTOMER_WISHLIST_QUERY, { id });
    return data.customer?.wishlist_v2 ?? undefined;
  }

  /** All wishlists of the customer. `wishlists` reports no total, so it is walked to the end. */
  protected async fetchAllWishlists(): Promise<MagentoWishlist[]> {
    const all: MagentoWishlist[] = [];
    for (let currentPage = 1; currentPage <= this.fetchAllMaxPages; currentPage++) {
      const data = await this.gql(MagentoCustomerWishlistsResponseSchema, CUSTOMER_WISHLISTS_QUERY, {
        pageSize: this.fetchAllPageSize,
        currentPage,
      });
      const page = (data.customer?.wishlists ?? []).filter(
        (wishlist): wishlist is MagentoWishlist => wishlist !== null,
      );
      all.push(...page);
      if (page.length < this.fetchAllPageSize) {
        break;
      }
    }
    return all;
  }

  protected async fetchRequisitionList(uid: string): Promise<MagentoRequisitionList | undefined> {
    const data = await this.gql(
      MagentoCustomerRequisitionListsResponseSchema,
      CUSTOMER_REQUISITION_LISTS_QUERY,
      { pageSize: 1, currentPage: 1, filter: { uids: { eq: uid } } },
    );
    const list = data.customer?.requisition_lists?.items.find((item) => item?.uid === uid);
    return list ?? undefined;
  }

  /** One page of a list's items, or undefined when the list does not exist. */
  protected async fetchItemsPage(
    kind: MagentoProductListKind,
    list: ProductListIdentifier,
    pageSize: number,
    currentPage: number,
  ): Promise<{ items: MagentoProductListItemSource[]; totalCount: number } | undefined> {
    const offset = (currentPage - 1) * pageSize;

    if (kind === 'wishlist') {
      const data = await this.gql(MagentoCustomerWishlistResponseSchema, CUSTOMER_WISHLIST_ITEMS_QUERY, {
        id: list.key,
        pageSize,
        currentPage,
      });
      const wishlist = data.customer?.wishlist_v2;
      if (!wishlist) {
        return undefined;
      }
      const items = (wishlist.items_v2?.items ?? []).flatMap((item, index) =>
        item ? [{ kind: 'wishlist' as const, list, item, position: offset + index + 1 }] : [],
      );
      return { items, totalCount: wishlist.items_count ?? offset + items.length };
    }

    const data = await this.gql(
      MagentoCustomerRequisitionListsResponseSchema,
      CUSTOMER_REQUISITION_LIST_ITEMS_QUERY,
      { uid: list.key, pageSize, currentPage },
    );
    const requisitionList = data.customer?.requisition_lists?.items.find((item) => item?.uid === list.key);
    if (!requisitionList) {
      return undefined;
    }
    const items = (requisitionList.items?.items ?? []).flatMap((item, index) =>
      item ? [{ kind: 'requisition' as const, list, item, position: offset + index + 1 }] : [],
    );
    return { items, totalCount: requisitionList.items_count ?? offset + items.length };
  }

  /** Every item of a list, or undefined when the list does not exist. */
  protected async fetchAllItems(
    kind: MagentoProductListKind,
    list: ProductListIdentifier,
  ): Promise<MagentoProductListItemSource[] | undefined> {
    const all: MagentoProductListItemSource[] = [];
    for (let currentPage = 1; currentPage <= this.fetchAllMaxPages; currentPage++) {
      const page = await this.fetchItemsPage(kind, list, this.fetchAllPageSize, currentPage);
      if (!page) {
        return currentPage === 1 ? undefined : all;
      }
      all.push(...page.items);
      if (page.items.length < this.fetchAllPageSize || all.length >= page.totalCount) {
        break;
      }
    }
    return all;
  }

  protected itemSku(source: MagentoProductListItemSource): string | undefined {
    if (source.kind === 'wishlist') {
      return source.item.configured_variant?.sku || source.item.product?.sku;
    }
    return source.item.product?.sku;
  }

  protected itemKey(source: MagentoProductListItemSource): string {
    return source.kind === 'wishlist' ? source.item.id : source.item.uid;
  }

  // --- lists ----------------------------------------------------------------------

  @Reactionary({
    inputSchema: ProductListQueryByIdSchema,
    outputSchema: ProductListSchema,
  })
  public override async getById(
    payload: ProductListQueryById,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    const kind = this.resolveKind(payload.identifier.listType);
    if (!kind) {
      return this.unsupportedListType(payload.identifier.listType);
    }
    if (!this.isRegistered()) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
    }

    try {
      if (kind === 'wishlist') {
        const wishlist = await this.fetchWishlist(payload.identifier.key);
        if (!wishlist) {
          return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
        }
        return success(
          this.factory.parseProductList(
            this.context,
            this.wishlistSource(payload.identifier.listType, wishlist),
          ),
        );
      }

      const requisitionList = await this.fetchRequisitionList(payload.identifier.key);
      if (!requisitionList) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
      }
      return success(this.factory.parseProductList(this.context, this.requisitionSource(requisitionList)));
    } catch (err) {
      return handleMagentoProviderError('get product list', err, payload.identifier);
    }
  }

  @Reactionary({
    inputSchema: ProductListQuerySchema,
    outputSchema: ProductListPaginatedResultsSchema,
  })
  public override async queryLists(
    payload: ProductListQuery,
  ): Promise<Result<ProductListFactoryListPaginatedOutput<TFactory>>> {
    const kind = this.resolveKind(payload.search.listType);
    if (!kind) {
      return this.unsupportedListType(payload.search.listType);
    }
    if (!this.isRegistered()) {
      return success(
        this.factory.parseProductListPaginatedResult(this.context, { lists: [], totalCount: 0 }, payload),
      );
    }

    const { pageNumber, pageSize } = payload.search.paginationOptions;
    try {
      if (kind === 'wishlist') {
        const wishlists = await this.fetchAllWishlists();
        const start = (pageNumber - 1) * pageSize;
        const lists = wishlists
          .slice(start, start + pageSize)
          .map((wishlist) => this.wishlistSource(payload.search.listType, wishlist));
        return success(
          this.factory.parseProductListPaginatedResult(
            this.context,
            { lists, totalCount: wishlists.length },
            payload,
          ),
        );
      }

      const data = await this.gql(
        MagentoCustomerRequisitionListsResponseSchema,
        CUSTOMER_REQUISITION_LISTS_QUERY,
        { pageSize, currentPage: pageNumber },
      );
      const page = data.customer?.requisition_lists;
      const lists = (page?.items ?? []).flatMap((list) => (list ? [this.requisitionSource(list)] : []));
      return success(
        this.factory.parseProductListPaginatedResult(
          this.context,
          { lists, totalCount: page?.total_count ?? lists.length },
          payload,
        ),
      );
    } catch (err) {
      return handleMagentoProviderError('query product lists', err, payload.search);
    }
  }

  @Reactionary({
    inputSchema: ProductListMutationCreateSchema,
    outputSchema: ProductListSchema,
  })
  public override async addList(
    mutation: ProductListMutationCreate,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    const kind = this.resolveKind(mutation.list.type);
    if (!kind) {
      return this.unsupportedListType(mutation.list.type);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    try {
      if (kind === 'wishlist') {
        // Wishlists carry no description, image or publish date.
        const data = await this.gql(MagentoCreateWishlistResponseSchema, CREATE_WISHLIST_MUTATION, {
          input: {
            name: mutation.list.name,
            visibility: mutation.list.published ? 'PUBLIC' : 'PRIVATE',
          },
        });
        const wishlist = data.createWishlist?.wishlist;
        if (!wishlist) {
          return error({ type: 'Generic', message: 'Magento did not return the created wishlist' });
        }
        return success(
          this.factory.parseProductList(this.context, this.wishlistSource(mutation.list.type, wishlist)),
        );
      }

      const data = await this.gql(
        MagentoCreateRequisitionListResponseSchema,
        CREATE_REQUISITION_LIST_MUTATION,
        { input: { name: mutation.list.name, description: mutation.list.description } },
      );
      const requisitionList = data.createRequisitionList?.requisition_list;
      if (!requisitionList) {
        return error({ type: 'Generic', message: 'Magento did not return the created requisition list' });
      }
      return success(this.factory.parseProductList(this.context, this.requisitionSource(requisitionList)));
    } catch (err) {
      return handleMagentoProviderError('create product list', err);
    }
  }

  @Reactionary({
    inputSchema: ProductListMutationUpdateSchema,
    outputSchema: ProductListSchema,
  })
  public override async updateList(
    mutation: ProductListMutationUpdate,
  ): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    const kind = this.resolveKind(mutation.list.listType);
    if (!kind) {
      return this.unsupportedListType(mutation.list.listType);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    try {
      if (kind === 'wishlist') {
        // Only name and visibility are editable on a Magento wishlist.
        if (mutation.name !== undefined || mutation.published !== undefined) {
          const data = await this.gql(MagentoUpdateWishlistResponseSchema, UPDATE_WISHLIST_MUTATION, {
            wishlistId: mutation.list.key,
            name: mutation.name,
            visibility:
              mutation.published === undefined ? undefined : mutation.published ? 'PUBLIC' : 'PRIVATE',
          });
          if (!data.updateWishlist) {
            return error<NotFoundError>({ type: 'NotFound', identifier: mutation.list });
          }
        }
        const wishlist = await this.fetchWishlist(mutation.list.key);
        if (!wishlist) {
          return error<NotFoundError>({ type: 'NotFound', identifier: mutation.list });
        }
        return success(
          this.factory.parseProductList(this.context, this.wishlistSource(mutation.list.listType, wishlist)),
        );
      }

      // updateRequisitionList requires the name, so unchanged fields are carried over.
      const current = await this.fetchRequisitionList(mutation.list.key);
      if (!current) {
        return error<NotFoundError>({ type: 'NotFound', identifier: mutation.list });
      }
      const data = await this.gql(
        MagentoUpdateRequisitionListResponseSchema,
        UPDATE_REQUISITION_LIST_MUTATION,
        {
          requisitionListUid: mutation.list.key,
          input: {
            name: mutation.name ?? current.name,
            description: mutation.description ?? current.description ?? undefined,
          },
        },
      );
      const requisitionList = data.updateRequisitionList?.requisition_list;
      if (!requisitionList) {
        return error<NotFoundError>({ type: 'NotFound', identifier: mutation.list });
      }
      return success(this.factory.parseProductList(this.context, this.requisitionSource(requisitionList)));
    } catch (err) {
      return handleMagentoProviderError('update product list', err, mutation.list);
    }
  }

  @Reactionary({
    inputSchema: ProductListMutationDeleteSchema,
  })
  public override async deleteList(mutation: ProductListMutationDelete): Promise<Result<void>> {
    const kind = this.resolveKind(mutation.list.listType);
    if (!kind) {
      return this.unsupportedListType(mutation.list.listType);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    try {
      let deleted: boolean;
      if (kind === 'wishlist') {
        const data = await this.gql(MagentoDeleteWishlistResponseSchema, DELETE_WISHLIST_MUTATION, {
          wishlistId: mutation.list.key,
        });
        deleted = data.deleteWishlist?.status === true;
      } else {
        const data = await this.gql(
          MagentoDeleteRequisitionListResponseSchema,
          DELETE_REQUISITION_LIST_MUTATION,
          { requisitionListUid: mutation.list.key },
        );
        deleted = data.deleteRequisitionList?.status === true;
      }

      if (!deleted) {
        return error({ type: 'Generic', message: `Magento did not delete product list ${mutation.list.key}` });
      }
      return success(undefined);
    } catch (err) {
      return handleMagentoProviderError('delete product list', err, mutation.list);
    }
  }

  // --- items ----------------------------------------------------------------------

  @Reactionary({
    inputSchema: ProductListItemQuerySchema,
    outputSchema: ProductListItemPaginatedResultsSchema,
  })
  public override async queryListItems(
    query: ProductListItemsQuery,
  ): Promise<Result<ProductListFactoryItemPaginatedOutput<TFactory>>> {
    const list = query.search.list;
    const kind = this.resolveKind(list.listType);
    if (!kind) {
      return this.unsupportedListType(list.listType);
    }
    if (!this.isRegistered()) {
      return error<NotFoundError>({ type: 'NotFound', identifier: list });
    }

    const { pageNumber, pageSize } = query.search.paginationOptions;
    try {
      const page = await this.fetchItemsPage(kind, list, pageSize, pageNumber);
      if (!page) {
        return error<NotFoundError>({ type: 'NotFound', identifier: list });
      }
      return success(this.factory.parseProductListItemPaginatedResult(this.context, page, query));
    } catch (err) {
      return handleMagentoProviderError('query product list items', err, list);
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationCreateSchema,
    outputSchema: ProductListItemSchema,
  })
  public override async addItem(
    mutation: ProductListItemMutationCreate,
  ): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    const kind = this.resolveKind(mutation.list.listType);
    if (!kind) {
      return this.unsupportedListType(mutation.list.listType);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    const sku = mutation.listItem.variant.sku;
    try {
      if (kind === 'wishlist') {
        const data = await this.gql(
          MagentoAddProductsToWishlistResponseSchema,
          ADD_PRODUCTS_TO_WISHLIST_MUTATION,
          { wishlistId: mutation.list.key, wishlistItems: [{ sku, quantity: mutation.listItem.quantity }] },
        );
        const failure = this.userErrorsFailure(data.addProductsToWishlist?.user_errors);
        if (failure) {
          return failure;
        }
      } else {
        // Requisition list items carry no notes; `notes` is not stored.
        await this.gql(
          MagentoAddProductsToRequisitionListResponseSchema,
          ADD_PRODUCTS_TO_REQUISITION_LIST_MUTATION,
          {
            requisitionListUid: mutation.list.key,
            requisitionListItems: [{ sku, quantity: mutation.listItem.quantity }],
          },
        );
      }

      // Neither mutation reports which item it created (Magento may also merge
      // into an existing line), so the newest line for the SKU is looked up.
      const items = await this.fetchAllItems(kind, mutation.list);
      if (!items) {
        return error<NotFoundError>({ type: 'NotFound', identifier: mutation.list });
      }
      const matches = items.filter((item) => this.itemSku(item) === sku);
      let added = matches[matches.length - 1];
      if (!added) {
        return error({
          type: 'Generic',
          message: `Magento accepted SKU ${sku} but it could not be found on list ${mutation.list.key}`,
        });
      }

      // Wishlist notes can only be set by updating the item after adding it.
      if (added.kind === 'wishlist' && mutation.listItem.notes) {
        const update = await this.gql(
          MagentoUpdateProductsInWishlistResponseSchema,
          UPDATE_PRODUCTS_IN_WISHLIST_MUTATION,
          {
            wishlistId: mutation.list.key,
            wishlistItems: [{ wishlist_item_id: added.item.id, description: mutation.listItem.notes }],
          },
        );
        const failure = this.userErrorsFailure(update.updateProductsInWishlist?.user_errors);
        if (failure) {
          return failure;
        }
        added = { ...added, item: { ...added.item, description: mutation.listItem.notes } };
      }

      return success(this.factory.parseProductListItem(this.context, added));
    } catch (err) {
      return handleMagentoProviderError('add product list item', err, mutation.list);
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationUpdateSchema,
    outputSchema: ProductListItemSchema,
  })
  public override async updateItem(
    mutation: ProductListItemMutationUpdate,
  ): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    const list = mutation.listItem.list;
    const kind = this.resolveKind(list.listType);
    if (!kind) {
      return this.unsupportedListType(list.listType);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    // Magento keeps no per-item order, so `order` is not stored.
    try {
      if (kind === 'wishlist') {
        if (mutation.quantity !== undefined || mutation.notes !== undefined) {
          const data = await this.gql(
            MagentoUpdateProductsInWishlistResponseSchema,
            UPDATE_PRODUCTS_IN_WISHLIST_MUTATION,
            {
              wishlistId: list.key,
              wishlistItems: [
                {
                  wishlist_item_id: mutation.listItem.key,
                  quantity: mutation.quantity,
                  description: mutation.notes,
                },
              ],
            },
          );
          const failure = this.userErrorsFailure(data.updateProductsInWishlist?.user_errors);
          if (failure) {
            return failure;
          }
        }
      } else if (mutation.quantity !== undefined) {
        // Requisition list items carry no notes; `notes` is not stored.
        await this.gql(
          MagentoUpdateRequisitionListItemsResponseSchema,
          UPDATE_REQUISITION_LIST_ITEMS_MUTATION,
          {
            requisitionListUid: list.key,
            requisitionListItems: [{ item_id: mutation.listItem.key, quantity: mutation.quantity }],
          },
        );
      }

      const items = await this.fetchAllItems(kind, list);
      const updated = items?.find((item) => this.itemKey(item) === mutation.listItem.key);
      if (!updated) {
        return error<NotFoundError>({ type: 'NotFound', identifier: mutation.listItem });
      }
      return success(this.factory.parseProductListItem(this.context, updated));
    } catch (err) {
      return handleMagentoProviderError('update product list item', err, mutation.listItem);
    }
  }

  @Reactionary({
    inputSchema: ProductListItemMutationDeleteSchema,
  })
  public override async deleteItem(mutation: ProductListItemMutationDelete): Promise<Result<void>> {
    const list = mutation.listItem.list;
    const kind = this.resolveKind(list.listType);
    if (!kind) {
      return this.unsupportedListType(list.listType);
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    try {
      if (kind === 'wishlist') {
        const data = await this.gql(
          MagentoRemoveProductsFromWishlistResponseSchema,
          REMOVE_PRODUCTS_FROM_WISHLIST_MUTATION,
          { wishlistId: list.key, wishlistItemsIds: [mutation.listItem.key] },
        );
        const failure = this.userErrorsFailure(data.removeProductsFromWishlist?.user_errors);
        if (failure) {
          return failure;
        }
      } else {
        await this.gql(
          MagentoDeleteRequisitionListItemsResponseSchema,
          DELETE_REQUISITION_LIST_ITEMS_MUTATION,
          { requisitionListUid: list.key, requisitionListItemUids: [mutation.listItem.key] },
        );
      }
      return success(undefined);
    } catch (err) {
      return handleMagentoProviderError('delete product list item', err, mutation.listItem);
    }
  }

  // --- Magento-only extension -----------------------------------------------------

  /**
   * Copies a requisition list (all items, or `itemKeys` only) into the signed-in
   * customer's active cart via Adobe Commerce B2B `addRequisitionListItemsToCart`.
   * Not part of the core product list contract.
   *
   * Magento has no way to target a specific cart: the items always land in the
   * customer's own cart. A masked `cart` id is checked against that cart and a
   * mismatch is rejected; a numeric (REST quote) id can't be compared and is
   * accepted as is. Returns the masked id of the cart the items were added to.
   */
  @Reactionary({
    inputSchema: MagentoProductListAddToCartSchema,
    outputSchema: CartIdentifierSchema,
  })
  public async addListToCart(payload: MagentoProductListAddToCart): Promise<Result<CartIdentifier>> {
    if (payload.list.listType !== 'requisition') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Only requisition lists can be added to the cart by the Magento provider',
      });
    }
    if (!this.isRegistered()) {
      return this.notRegistered();
    }

    try {
      const requestedCart = payload.cart?.key;
      if (requestedCart && !/^\d+$/.test(requestedCart)) {
        const customerCart = await this.gql(MagentoCustomerCartIdResponseSchema, CUSTOMER_CART_ID_QUERY);
        if (customerCart.customerCart?.id !== requestedCart) {
          return error<InvalidInputError>({
            type: 'InvalidInput',
            error: "Magento can only add a requisition list to the customer's own active cart",
          });
        }
      }

      const data = await this.gql(
        MagentoAddRequisitionListItemsToCartResponseSchema,
        ADD_REQUISITION_LIST_ITEMS_TO_CART_MUTATION,
        { requisitionListUid: payload.list.key, requisitionListItemUids: payload.itemKeys },
      );
      const output = data.addRequisitionListItemsToCart;
      const failure = this.userErrorsFailure(output?.add_requisition_list_items_to_cart_user_errors);
      if (failure) {
        return failure;
      }
      if (!output?.status || !output.cart?.id) {
        return error({
          type: 'Generic',
          message: `Magento did not add requisition list ${payload.list.key} to the cart`,
        });
      }
      debug('added requisition list %s to cart %s', payload.list.key, output.cart.id);
      return success({ key: output.cart.id });
    } catch (err) {
      return handleMagentoProviderError('add requisition list to cart', err, payload.list);
    }
  }
}
