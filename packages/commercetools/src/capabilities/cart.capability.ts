import type { BusinessUnitResourceIdentifier, CartDraft, CartUpdateAction, CustomFieldsDraft, MyCartUpdateAction } from '@commercetools/platform-sdk';
import type {
  Cache,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationCreateCart,
  CartMutationDeleteCart,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartMutationRemoveCoupon,
  CartMutationRenameCart,
  CartPaginatedSearchResult,
  CartQueryById,
  CartQueryList,
  CompanyIdentifier,
  NotFoundError,
  RequestContext,
  Result,
  InvalidInputError,
  Cart
} from '@reactionary/core';
import {
  assertSuccess,
  CartCapability,
  CartIdentifierSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartQueryByIdSchema,
  CartSchema,
  error,
  Reactionary,
  success,
  type CartFactory,
  type CartFactoryCartOutput,
  type CartFactoryWithOutput
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';
import type { CommercetoolsCartIdentifier, CommercetoolsCartItemIdentifier } from '../schema/commercetools.schema.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsCartCapability<
  TFactory extends CartFactory = CommercetoolsCartFactory,
> extends CartCapability<CartFactoryCartOutput<TFactory>, CartIdentifier> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected expandedCartFields = ['discountCodes[*].discountCode'];
  protected factory: CartFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  public override async  listCarts(payload: CartQueryList): Promise<Result<CartPaginatedSearchResult>> {
    const cartsClient = (await this.getClient(payload.search.company)).carts;

    const response = await cartsClient.get({
      queryArgs: {
        limit: payload.search.paginationOptions.pageSize,
        offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
      },
    }).execute();

    return success(this.factory.parseCartPaginatedSearchResult(this.context, response.body, payload));
  }

  public override async renameCart(payload: CartMutationRenameCart): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const actionResult = await this.applyActions(payload.cart, [
      {
        action: 'setCustomField',
        name: 'name',
        value: payload.newName,
      },
    ]);
    return success(actionResult);
  }

  protected createCartPayload(payload: CartMutationCreateCart): CartDraft {

    let businessUnitReference: BusinessUnitResourceIdentifier | undefined = undefined;
    if (payload.company) {
      businessUnitReference = {
        typeId: 'business-unit',
        key: payload.company.taxIdentifier,
      };
    }

    const customFields: CustomFieldsDraft = {
      type: {
        typeId: 'type',
        key: 'reactionaryCart',
      },
      fields: {
        name: payload.name,
      },
    };


    const body =  {
        currency:  this.context.languageContext.currencyCode || 'EUR',
        country:  this.context.taxJurisdiction.countryCode || 'DK',
        locale: this.context.languageContext.locale,
        businessUnit: businessUnitReference,
        custom: customFields,
      } satisfies CartDraft;

    return body;
  }

  public override async createCart(payload: CartMutationCreateCart): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cartsClient = (await this.getClient(payload.company)).carts;
    const response = await cartsClient.post({
        body: this.createCartPayload(payload),
        queryArgs: {
          expand: this.expandedCartFields,
        },
      })
      .execute();



    return success(this.factory.parseCart(this.context, response.body));
  }


  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    const company = await this.getCompanyForCart(payload.cart);
    const client = await this.getClient(company);
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    try {
      const remote = await client.carts
        .withId({ ID: ctId.key })
        .get({
          queryArgs: {
            expand: this.expandedCartFields,
          },
        })
        .execute();

      return success(this.factory.parseCart(this.context, remote.body));
    } catch (err) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: ctId,
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cartIdentifier = payload.cart;
    if (!cartIdentifier) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Cart identifier is required to add item to cart. If you want to create a new cart, you can call the createCart mutation first.',
      });
    }

    const channelId = await this.commercetools.resolveChannelIdByRole('Primary');

    const actions: (MyCartUpdateAction & CartUpdateAction) [] = []

    actions.push({
      action: 'addLineItem',
      quantity: payload.quantity,
      sku: payload.variant.sku,
      // FIXME: This should be dynamic, probably as part of the context...
      distributionChannel: {
        typeId: 'channel',
        id: channelId,
      },
    });


    const result = await this.applyActions(cartIdentifier, [
      ...actions,
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const result = await this.applyActions(payload.cart, [
      {
        action: 'removeLineItem',
        lineItemId: payload.item.key,
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    // annoyingly, once we have started using external prices,
    // it needs us to reflect it back in the change quantity call, otherwise it will reset the price to the original price.

    const lineIdentifier = payload.item as CommercetoolsCartItemIdentifier;
    const result = await this.applyActions(payload.cart, [
      {
        action: 'changeLineItemQuantity',
        lineItemId: lineIdentifier.key,
        quantity: payload.quantity,
        ...(lineIdentifier.originalPrice && {
          externalPrice: {
            currencyCode: lineIdentifier.originalPrice.currency,
            centAmount: Math.floor(lineIdentifier.originalPrice.value * 100),
          },
        })
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartIdentifier, NotFoundError>
  > {
    const client = await this.getClient();
    try {
      const carts = await client.carts.get({ queryArgs: {
        sort: 'lastModifiedAt desc',
        limit: 1,
      }}).execute();

      if (carts.body.results.length === 0) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: {},
        });
      }
      const result = this.factory.parseCartIdentifier(this.context, carts.body.results[0]);

      return success(result);
    } catch (e: any) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: {},
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart,
  ): Promise<Result<void>> {
    const company = await this.getCompanyForCart(payload.cart);
    const client = await this.getClient(company);
    if (payload.cart.key) {
      const ctId = payload.cart as CommercetoolsCartIdentifier;

      await client.carts
        .withId({ ID: ctId.key })
        .delete({
          queryArgs: {
            version: ctId.version,
            dataErasure: false,
          },
        })
        .execute();
    }

    return success(undefined);
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {

    const result = await this.applyActions(payload.cart, [
      {
        action: 'addDiscountCode',
        code: payload.couponCode,
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {

    const company = await this.getCompanyForCart(payload.cart);
    const client = await this.getClient(company);
    const currentCart = await client.carts
      .withId({ ID: payload.cart.key })
      .get({
        queryArgs: {
          expand: this.expandedCartFields,
        },
      })
      .execute();

    const discountCodeReference = currentCart.body.discountCodes?.find(
      (dc) => dc.discountCode.obj?.code === payload.couponCode,
    )?.discountCode;

    if (!discountCodeReference) {
      // Coupon code is not applied to the cart, so we can just return the cart as is.
      return success(this.factory.parseCart(this.context, currentCart.body));
    }
    const result = await this.applyActions(payload.cart, [
      {
        action: 'removeDiscountCode',
        discountCode: {
          id: discountCodeReference.id,
          typeId: 'discount-code',
        },
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    // ok, to do this we have to actually build a new cart, copy over all the items, and then delete the old cart.
    // because Commercetools does not support changing currency of an existing cart.

    // This is obviously not ideal, but it is what it is.
    const company = await this.getCompanyForCart(payload.cart);
    const client = await this.getClient(company);
    const currentCart = await client.carts
      .withId({ ID: payload.cart.key })
      .get()
      .execute();
    const newCart = await client.carts
      .post({
        body: {
          currency: payload.newCurrency,
          locale: this.context.languageContext.locale,
          country: currentCart.body.country,
          ...(company && {
            businessUnit: {
              typeId: 'business-unit',
              key: company.taxIdentifier,
            },
          }),
        },
      })
      .execute();

    const newCartId = this.factory.parseCartIdentifier(this.context, newCart.body);

    const cartItemAdds: (CartUpdateAction & MyCartUpdateAction)[] = currentCart.body.lineItems.map(
      (item) => ({
        action: 'addLineItem',
        sku: item.variant.sku || '',
        quantity: item.quantity,
        custom: item.custom,
      }),
    );

    const response = await this.applyActions(newCartId, [
      ...cartItemAdds,
      {
        action: 'recalculate',
      },
    ]);

    // now delete the old cart.
    await client.carts
      .withId({ ID: payload.cart.key })
      .delete({
        queryArgs: {
          version: currentCart.body.version || 0,
          dataErasure: false,
        },
      })
      .execute();

    return success(response);
  }

  protected async getCompanyForCart(cart: CartIdentifier): Promise<CompanyIdentifier | undefined> {

    if ('version' in cart && 'company' in cart) {
      return cart.company as CompanyIdentifier | undefined;
    }

    const client = await this.getClient();
    try {
      const cartResponse = await client.carts.withId({ ID: cart.key }).get().execute();

      if (cartResponse.body.businessUnit) {
        return {
          taxIdentifier: cartResponse.body.businessUnit.key,
        };
      }

      return undefined;
    } catch (e) {
      console.error('Error fetching cart for company information:', e);
      return undefined;
    }
  }

  protected async applyActions(
    cart: CartIdentifier,
    actions: (MyCartUpdateAction & CartUpdateAction)[],
  ): Promise<CartFactoryCartOutput<TFactory>> {

    const company =  await this.getCompanyForCart(cart);

    const client = await this.getClient(company);
    const ctId = cart as CommercetoolsCartIdentifier;

    try {
      const response = await client.carts
        .withId({ ID: ctId.key })
        .post({
          body: {
            version: ctId.version,
            actions,
          },
          queryArgs: {
            expand: this.expandedCartFields,
          },
        })
        .execute();

      if (response.error) {
        console.error(response.error);
      }
      return this.factory.parseCart(this.context, response.body);
    } catch (e: any) {
      console.error('Error applying actions to cart:', e);
      throw e;
    }
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

    return {
      carts: client.carts(),
      orders: client.orders(),
    };
  }
}
