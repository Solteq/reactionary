import type { BusinessUnitResourceIdentifier, ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder, ByProjectKeyMeRequestBuilder, CustomerResourceIdentifier, CustomFieldsDraft, MyShoppingListAddLineItemAction, MyShoppingListUpdate, MyShoppingListUpdateAction, ShoppingListDraft, ShoppingListPagedQueryResponse } from '@commercetools/platform-sdk';
import type {
  Cache,
  CompanyIdentifier,
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
  RequestContext,
  Result
} from '@reactionary/core';
import {
  error,
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
  success,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsProductListFactory } from '../factories/product-list/product-list.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsProductListCapability<
  TFactory extends ProductListFactory = CommercetoolsProductListFactory,
> extends ProductListCapability<
  ProductListFactoryListOutput<TFactory>,
  ProductListFactoryItemOutput<TFactory>,
  ProductListFactoryListPaginatedOutput<TFactory>,
  ProductListFactoryItemPaginatedOutput<TFactory>
> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: ProductListFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: ProductListFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  /**
   * Creates a new Commercetools client, optionally upgrading it from Anonymous mode to Guest mode.
   * For now, any Query or Mutation will require an upgrade to Guest mode.
   * In the future, maybe we can delay this upgrade until we actually need it.
   */
  protected async getClient(companyIdentifier?: CompanyIdentifier) {

    let client;
    if (companyIdentifier) {
      client = await this.commercetools.getClientForCompany(companyIdentifier);
    } else {
      client = (await this.commercetools.getClient()).withProjectKey({ projectKey: this.config.projectKey }).me();
    }

    return client;
  }
  protected async isMine(listIdentifier: ProductListIdentifier): Promise<boolean> {
    if (this.context.session.identityContext?.identity.type !== 'Registered') {
      return false;
    }
    if (this.context.session.identityContext?.identity.id.userId === listIdentifier.user?.userId) {
      return true;
    }
    return false;
  }

  protected async getCompanyForList(listIdentifier: ProductListIdentifier): Promise<CompanyIdentifier | undefined> {
    if ('version' in listIdentifier && 'company' in listIdentifier) {
      return listIdentifier.company as CompanyIdentifier | undefined;
    }
        const client = await this.getClient();
    try {
      const listResponse = await client.shoppingLists().withId({ ID: listIdentifier.key }).get().execute();

      if (listResponse.body.businessUnit) {
        return {
          taxIdentifier: listResponse.body.businessUnit.key,
        };
      }

      return undefined;
    } catch (e) {
      console.error('Error fetching list for company information:', e);
      return undefined;
    }
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
    inputSchema: ProductListQueryByIdSchema,
    outputSchema: ProductListSchema
  })
  public override async getById(payload: ProductListQueryById): Promise<Result<ProductListFactoryListOutput<TFactory>>> {


    try {
      const companyIdentifier =  await this.getCompanyForList(payload.identifier);
      const client = await this.getClient(companyIdentifier);
      const response = await client.shoppingLists()
        .withId({ ID: payload.identifier.key })
        .get()
        .execute();

      const payloadResult = this.factory.parseProductList(this.context, response.body);

      if (!await this.isMine(payloadResult.identifier)) {
        if (!payloadResult.published) {
          return error<NotFoundError>({
            type: 'NotFound',
            identifier: payload.identifier
          });
        }
      }

      return success(this.factory.parseProductList(this.context, response.body));
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
  public override async queryLists(payload: ProductListQuery): Promise<Result<ProductListFactoryListPaginatedOutput<TFactory>>> {

    if (this.context.session.identityContext?.identity?.type !== 'Registered') {
      return success(this.factory.parseProductListPaginatedResult(this.context, {
        limit: payload.search.paginationOptions.pageSize,
        offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
        count: payload.search.paginationOptions.pageSize,
        results: [],
        total: 0,
      } satisfies ShoppingListPagedQueryResponse, payload));
    }

    const client = await this.getClient(payload.search.company);

    let where = ``;


    const listTypeFilter = `custom(fields(listType=:listType))`;
    const allOfMineFilter = `(customer(id=:customerId))`;
    const othersFilter = `(customer(id != :customerId) and custom(fields(published=true)))`;
    let companyFilter = `businessUnit is not defined`;
    if (payload.search.company) {
      companyFilter = `businessUnit(key=:companyKey)`;
    }
    where = `((${listTypeFilter}) and (${companyFilter})) and (${allOfMineFilter} or ${othersFilter})`;
    const customerId = this.context.session.identityContext?.identity.type === 'Registered' ? this.context.session.identityContext?.identity.id.userId : 'anonymous';
    const companyKey = payload.search.company?.taxIdentifier || undefined;
    const response = await client.shoppingLists().get({
      queryArgs: {
        where,
        sort: 'createdAt desc',
        'var.listType': payload.search.listType,
        'var.published': true,
        'var.customerId': customerId,
        'var.companyKey': companyKey,
        limit: payload.search.paginationOptions.pageSize,
        offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize
      }
    }).execute();

    return success(this.factory.parseProductListPaginatedResult(this.context, response.body, payload));

  }


  protected addListPayload(payload: ProductListMutationCreate): ShoppingListDraft {
    const localeString = this.getLocaleString();

    let businessUnitReference: BusinessUnitResourceIdentifier | undefined = undefined;
    let customerReference: CustomerResourceIdentifier | undefined = undefined;
    if (payload.company) {
      businessUnitReference = {
        typeId: 'business-unit',
        key: payload.company.taxIdentifier,
      };
      if (this.context.session.identityContext?.identity.type === 'Registered' && this.context.session.identityContext?.identity.id) {
        customerReference = {
          typeId: 'customer',
          id: this.context.session.identityContext?.identity.id.userId,
        };
      }
    }

    const customFields: CustomFieldsDraft = {
      type: {
        typeId: 'type',
        key: 'reactionaryShoppingList',
      },
      fields: {
          listType: payload.list.type,
          imageUrl: payload.list.image ? payload.list.image.sourceUrl : undefined,
          publishedDate: payload.list.publishDate  ? new Date(payload.list.publishDate) : undefined,
          published: payload.list.published && true,
      },
    };



     const draft:  ShoppingListDraft = {
      name: { [localeString]: payload.list.name },
      businessUnit: businessUnitReference,
      customer: customerReference ,
      description: payload.list.description ? { [localeString]: payload.list.description } : undefined,
      custom: customFields
    }
    return draft;
  }

  @Reactionary({
    cache: false, // Mutations should not be cached
    inputSchema: ProductListMutationCreateSchema,
    outputSchema: ProductListSchema
  })
  public override async addList(mutation: ProductListMutationCreate): Promise<Result<ProductListFactoryListOutput<TFactory>>> {

    const client = await this.getClient(mutation.company);

    if (this.context.session.identityContext?.identity?.type !== 'Registered') {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Only registered users can have product lists',
      });
    }



    const list = this.addListPayload(mutation);
    const response = await client.shoppingLists().post({
      body: list
    }).execute();

    return success(this.factory.parseProductList(this.context, response.body));
  }




  @Reactionary({
    cache: false,
    inputSchema: ProductListMutationUpdateSchema,
    outputSchema: ProductListSchema
  })
  public override async updateList(mutation: ProductListMutationUpdate): Promise<Result<ProductListFactoryListOutput<TFactory>>> {
    const companyIdentifier =  await this.getCompanyForList(mutation.list);
    const client = await this.getClient(companyIdentifier);

    if (!await this.isMine(mutation.list)) {
      if (await this.isUnpublished(mutation.list, client)) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cannot update a list that is not yours, unless it is published',
        });
      }
    }

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

    return success(this.factory.parseProductList(this.context, response.body));
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListMutationDeleteSchema,
  })
  public override async deleteList(mutation: ProductListMutationDelete): Promise<Result<void>> {
    const companyIdentifier =  await this.getCompanyForList(mutation.list);
    const client = await this.getClient(companyIdentifier);

    if (!await this.isMine(mutation.list)) {
      if (await this.isUnpublished(mutation.list, client)) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cannot delete from a list that is not yours, unless it is published',
        });
      }
    }


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
  public override async queryListItems(query: ProductListItemsQuery): Promise<Result<ProductListFactoryItemPaginatedOutput<TFactory>>> {
    const companyIdentifier =  await this.getCompanyForList(query.search.list);
    const client = await this.getClient(companyIdentifier);

    const response = await client.shoppingLists()
      .withId({ ID: query.search.list.key })
      .get({
        queryArgs: { expand: 'lineItems[*].variant' }
      })
      .execute();


    return success(this.factory.parseProductListItemPaginatedResult(this.context, response.body, query));
  }

  @Reactionary({
    cache: false,
    inputSchema: ProductListItemMutationCreateSchema,
    outputSchema: ProductListItemSchema
  })
  public override async addItem(mutation: ProductListItemMutationCreate): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    const companyIdentifier =  await this.getCompanyForList(mutation.list);
    const client = await this.getClient(companyIdentifier);
    const myList = await this.isMine(mutation.list);

    if (!myList) {
      if (await this.isUnpublished(mutation.list, client)) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cannot add items to a list that is not yours, unless it is published',
        });
      }
    }


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

    return success(this.factory.parseProductListItem(this.context, { listIdentifier: mutation.list, lineItem: lastItem }));
  }

  protected async isUnpublished(list: ProductListIdentifier, client: ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder | ByProjectKeyMeRequestBuilder): Promise<boolean> {
      const response = await client.shoppingLists().withId({ ID: list.key }).get().execute();
      const isPublished = (response.body.custom?.fields['published'] as boolean) && true;
      return !isPublished;
  }


  @Reactionary({
    cache: false,
    inputSchema: ProductListItemMutationDeleteSchema,
  })
  public override async deleteItem(mutation: ProductListItemMutationDelete): Promise<Result<void>> {
    const companyIdentifier =  await this.getCompanyForList(mutation.listItem.list);
    const client = await this.getClient(companyIdentifier);

    if (!await this.isMine(mutation.listItem.list)) {
      if (await this.isUnpublished(mutation.listItem.list, client)) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cannot delete items to a list that is not yours, unless it is published',
        });
      }
    }


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
  public override async updateItem(mutation: ProductListItemMutationUpdate): Promise<Result<ProductListFactoryItemOutput<TFactory>>> {
    const companyIdentifier =  await this.getCompanyForList(mutation.listItem.list);
    const client = await this.getClient(companyIdentifier);

    if (!await this.isMine(mutation.listItem.list)) {
      if (await this.isUnpublished(mutation.listItem.list, client)) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cannot update items in a list that is not yours, unless it is published',
        });
      }
    }


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

    return success(this.factory.parseProductListItem(this.context,  { listIdentifier: mutation.listItem.list, lineItem: updatedLineItem} ));
  }

  /**
   * It is not clear to me, why i'd want my CUSTOMER defined resources to be localized, since that means, if he changes visual language,
   * the names of his lists will disappear, since they are not translated. But maybe there are usecases for this, so we should support it, but default to english.
   **/
  protected getLocaleString() {
    return 'en';
  }


}
