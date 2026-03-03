import type { MyShoppingListAddLineItemAction, MyShoppingListDraft, MyShoppingListUpdate, MyShoppingListUpdateAction, ShoppingList, ShoppingListLineItem } from '@commercetools/platform-sdk';
import type {
  Cache,
  NotFoundError,
  ProductList,
  ProductListIdentifier,
  ProductListItem,
  ProductListItemMutationCreate,
  ProductListItemMutationDelete,
  ProductListItemMutationUpdate,
  ProductListItemPaginatedResult,
  ProductListItemsQuery,
  ProductListMutationCreate,
  ProductListMutationDelete,
  ProductListMutationUpdate,
  ProductListPaginatedResult,
  ProductListQuery,
  ProductListQueryById,
  ProductListType,
  RequestContext,
  Result,

  InvalidInputError} from '@reactionary/core';
import {
  error,
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
  ProductListProvider,
  ProductListQueryByIdSchema,
  ProductListQuerySchema,
  ProductListSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsProductListProvider extends ProductListProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey }).me();
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
    inputSchema: ProductListQueryByIdSchema,
    outputSchema: ProductListSchema
  })
  public override async getById(payload: ProductListQueryById): Promise<Result<ProductList>> {
    try {
      const client = await this.getClient();
      const response = await client.shoppingLists()
        .withId({ ID: payload.identifier.key })
        .get()
        .execute();

      return success(this.parseSingle(response.body));
    } catch(err: any) {
      if (err.statusCode === 404) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload
        });
      } else {
        throw err;
      }
    }
  }


  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
    inputSchema: ProductListQuerySchema,
    outputSchema: ProductListPaginatedResultsSchema
  })
  public override async queryLists(payload: ProductListQuery): Promise<Result<ProductListPaginatedResult>> {

    if (this.context.session.identityContext?.identity?.type !== 'Registered') {
      return success({
        items: [],
        pageNumber: 1,
        pageSize: payload.search.paginationOptions.pageSize,
        totalCount: 0,
        totalPages: 0,
        identifier: payload.search,
      });
    }

    const client = await this.getClient();
    const response = await client.shoppingLists().get({
      queryArgs: {
        where: `custom(fields(listType=:listType))`,
        sort: 'createdAt desc',
        'var.listType': payload.search.listType,
        limit: payload.search.paginationOptions.pageSize,
        offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize
      }
    }).execute();

    return success({
      items: response.body.results.map(list => this.parseSingle(list)),
      pageNumber: payload.search.paginationOptions.pageNumber,
      pageSize: payload.search.paginationOptions.pageSize,
      totalCount: response.body.total || 0,
      totalPages: Math.ceil((response.body.total || 0) / payload.search.paginationOptions.pageSize),
      identifier: payload.search,
    });

  }

  @Reactionary({
    cache: false, // Mutations should not be cached
    inputSchema: ProductListMutationCreateSchema,
    outputSchema: ProductListSchema
  })
  public override async addList(mutation: ProductListMutationCreate): Promise<Result<ProductList>> {
    const client = await this.getClient();
    const localeString = this.getLocaleString();

    if (this.context.session.identityContext?.identity?.type !== 'Registered') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Only registered users can have product lists',
      });
    }



    const draft: MyShoppingListDraft = {
      name: { [localeString]: mutation.list.name },
      description: mutation.list.description ? { [localeString]: mutation.list.description } : undefined,
      custom: {
        type: {
          key: 'reactionaryShoppingList',
          typeId: 'type'
        },
        fields: {
            listType: mutation.list.type,
            imageUrl: mutation.list.image ? mutation.list.image.sourceUrl : undefined,
            publishedDate: mutation.list.publishDate  ? new Date(mutation.list.publishDate) : undefined,
            published: mutation.list.published || true,
        }
      },
    }
    const response = await client.shoppingLists().post({
      body: draft
    }).execute();

    return success(this.parseSingle(response.body));
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListMutationUpdateSchema,
    outputSchema: ProductListSchema
  })
  public override async updateList(mutation: ProductListMutationUpdate): Promise<Result<ProductList>> {
    const client = await this.getClient();
    const actions: MyShoppingListUpdateAction[] = [];
    const localeString = this.getLocaleString()
    if (mutation.name) {
      actions.push({
        action: 'changeName',
        name: { [localeString]: mutation.name }
      });
    }

    if (mutation.description !== undefined) {
      actions.push({
        action: 'setDescription',
        description: mutation.description ? { [localeString]: mutation.description } : undefined
      });
    }

    if (mutation.published) {
      actions.push({
        action: 'setCustomField',
        name: 'published',
        value: mutation.published
      })
    }

    if (mutation.publishDate) {
      actions.push({
        action: 'setCustomField',
        name: 'publishedDate',
        value: new Date(mutation.publishDate)
      });
    }

    if (mutation.image) {
      actions.push({
        action: 'setCustomField',
        name: 'imageUrl',
        value: mutation.image.sourceUrl
      });
    }

    const update: MyShoppingListUpdate = {
      version: 0, // The auto-correcting middleware will deal with the version
      actions
    };

    const response = await client.shoppingLists()
      .withId({ ID: mutation.list.key })
      .post({ body: update })
      .execute();

    return success(this.parseSingle(response.body));
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListMutationDeleteSchema,
  })
  public override async deleteList(mutation: ProductListMutationDelete): Promise<Result<void>> {
    const client = await this.getClient();

    const newestVersion = await client.shoppingLists()
      .withId({ ID: mutation.list.key })
      .get()
      .execute()
      .then(response => response.body.version);

    await client.shoppingLists()
      .withId({ ID: mutation.list.key })
      .delete({
        queryArgs: {
          version: newestVersion
        }
      })
      .execute();

    return success(undefined);
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
    inputSchema: ProductListItemQuerySchema,
    outputSchema: ProductListItemPaginatedResultsSchema
  })
  public override async queryListItems(query: ProductListItemsQuery): Promise<Result<ProductListItemPaginatedResult>> {
    const client = await this.getClient();

    const response = await client.shoppingLists()
      .withId({ ID: query.search.list.key })
      .get({
        queryArgs: { expand: 'lineItems[*].variant' }
      })
      .execute();

    const items = response.body.lineItems.map(lineItem => this.parseProductListItem(query.search.list, lineItem ));

    return success({
      items: items.slice((query.search.paginationOptions.pageNumber - 1) * query.search.paginationOptions.pageSize, query.search.paginationOptions.pageNumber * query.search.paginationOptions.pageSize),
      identifier: query.search,
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: items.length,
      totalPages: Math.ceil(items.length / query.search.paginationOptions.pageSize),
    });
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListItemMutationCreateSchema,
    outputSchema: ProductListItemSchema
  })
  public override async addItem(mutation: ProductListItemMutationCreate): Promise<Result<ProductListItem>> {
    const client = await this.getClient();

    const lineItemDraft: MyShoppingListAddLineItemAction = {
      action: 'addLineItem',
      sku: mutation.listItem.variant.sku,
      quantity: mutation.listItem.quantity,
      custom: {
        type: {
          key: 'reactionaryShoppingListItem',
          typeId: 'type'
        },
        fields: {
          notes: mutation.listItem.notes || '',
          order: mutation.listItem.order || 1
        }
      }
    };

    const update: MyShoppingListUpdate = {
      version: 0, // The auto-correcting middleware will deal with the version
      actions: [lineItemDraft]
    };

    const response = await client.shoppingLists()
      .withId({ ID: mutation.list.key })
      .post({ body: update, queryArgs: { expand: 'lineItems[*].variant' } })
      .execute();

      const lastItem = response.body.lineItems[response.body.lineItems.length - 1];
      if (lastItem.variant?.sku !== mutation.listItem.variant.sku) {
        throw new Error('The added line item is not the last item in the list, cannot reliably determine the identifier of the added item');
      }

    return success(this.parseProductListItem(mutation.list, lastItem  ));
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListItemMutationDeleteSchema,
  })
  public override async deleteItem(mutation: ProductListItemMutationDelete): Promise<Result<void>> {
    const client = await this.getClient();

    const update: MyShoppingListUpdate = {
      version: 0, // The auto-correcting middleware will deal with the version
      actions: [{
        action: 'removeLineItem',
        lineItemId: mutation.listItem.key
      }]
    };

    await client.shoppingLists()
      .withId({ ID: mutation.listItem.list.key })
      .post({ body: update })
      .execute();

    return success(void 0);
  }


  @Reactionary({
    cache: false,
    inputSchema: ProductListItemMutationUpdateSchema,
    outputSchema: ProductListItemSchema
  })
  public override async updateItem(mutation: ProductListItemMutationUpdate): Promise<Result<ProductListItem>> {
    const client = await this.getClient();

    const actions: MyShoppingListUpdateAction[] = [];
    if (mutation.quantity !== undefined) {
      actions.push({
        action: 'changeLineItemQuantity',
        lineItemId: mutation.listItem.key,
        quantity: mutation.quantity
      });
    }

    if (mutation.notes !== undefined) {
      actions.push({
        action: 'setLineItemCustomField',
        lineItemId: mutation.listItem.key,
        name: 'notes',
        value: mutation.notes
      });
    }
    if (mutation.order !== undefined) {
        actions.push({
      action: 'setLineItemCustomField',
      lineItemId: mutation.listItem.key,
      name: 'order',
      value: mutation.order
    });
  }

    const update: MyShoppingListUpdate = {
      version: 0,
      actions
    };

    const response = await client.shoppingLists()
      .withId({ ID: mutation.listItem.list.key})
      .post({ body: update, queryArgs: { expand: 'lineItems[*].variant' } })
      .execute();

    // Find the updated line item
    const updatedLineItem = response.body.lineItems.find(item => item.id === mutation.listItem.key);
    if (!updatedLineItem) {
      throw new Error('Failed to find the updated line item in response');
    }

    return success(this.parseProductListItem(mutation.listItem.list, updatedLineItem));
  }

  /**
   * It is not clear to me, why i'd want my CUSTOMER defined resources to be localized, since that means, if he changes visual language,
   * the names of his lists will disappear, since they are not translated. But maybe there are usecases for this, so we should support it, but default to english.
   **/
  protected getLocaleString() {
    return 'en';
  }

  protected parseSingle(list: ShoppingList): ProductList {
    const localeString = this.getLocaleString();
    const listType = list.custom?.fields['listType'] as ProductListType || 'favorite';
    const image = list.custom?.fields['imageUrl'] as string | undefined;
    const published = list.custom?.fields['published'] as boolean && true;
    const publishDateDate = list.custom?.fields['publishedDate'] as string | undefined;
    let publishedDate: string | undefined;
    if (publishDateDate) {
      publishedDate = new Date(publishDateDate).toISOString();
    }

    return {
      identifier: {
        listType: listType as ProductListType,
        key: list.id
      },
      type: listType as ProductListType,
      name: list.name[localeString] ||  'Unnamed List',
      description: list.description?.[localeString] || '',
      published: published,
      publishDate: publishedDate,
      image: {
        sourceUrl: image || '',
        altText: list.name[localeString] || 'List Image'
      },
    };
  }

  protected parseProductListItem(listIdentifier: ProductListIdentifier, lineItem: ShoppingListLineItem): ProductListItem {
    const localeString = this.getLocaleString();
    return {
      identifier: {
        list: listIdentifier,
        key: lineItem.id
      },
      variant: {
        sku: lineItem.variant?.sku || ''
      },
      quantity: lineItem.quantity,
      notes: lineItem.custom?.fields['notes'] as string || '',
      order: lineItem.custom?.fields['order'] as number || 1, // Commercetools doesn't have explicit ordering
    };
  }
}
