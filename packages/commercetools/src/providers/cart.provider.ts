import {
  CartIdentifierSchema,
  type CartFactory,
  type CartFactoryCartOutput,
  type CartFactoryIdentifierOutput,
  type CartFactoryWithOutput,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartProvider,
  CartQueryByIdSchema,
  CartSchema,
  Reactionary,
  success,
  error,
  unwrapValue,
  assertSuccess,
} from '@reactionary/core';
import type {
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  CartMutationApplyCoupon,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon,
  CartMutationChangeCurrency,
  RequestContext,
  CartIdentifier,
  Cache,
  Result,
  NotFoundError,
  Promotion,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import type { CommercetoolsCartIdentifier } from '../schema/commercetools.schema.js';
import { CommercetoolsCartIdentifierSchema } from '../schema/commercetools.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsCartFactory } from '../factories/cart/cart.factory.js';

export class CommercetoolsCartProvider<
  TFactory extends CartFactory = CommercetoolsCartFactory,
> extends CartProvider<CartFactoryCartOutput<TFactory>, CartIdentifier> {
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

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();
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
    let cartIdentifier = payload.cart;
    if (!cartIdentifier) {
      cartIdentifier = await this.createCart();
    }

    const channelId =
      await this.commercetools.resolveChannelIdByRole('Primary');

    const result = await this.applyActions(cartIdentifier, [
      {
        action: 'addLineItem',
        quantity: payload.quantity,
        sku: payload.variant.sku,
        // FIXME: This should be dynamic, probably as part of the context...
        distributionChannel: {
          typeId: 'channel',
          id: channelId,
        },
      },
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
    if (payload.quantity === 0) {
      // Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
      // Calls with quantity 0 will just be ignored.
      const existing = await this.getById({ cart: payload.cart });

      // TODO: Should we instead allow returning NotFound here, if that is indeed the case?
      assertSuccess(existing);

      return existing;
    }

    const result = await this.applyActions(payload.cart, [
      {
        action: 'changeLineItemQuantity',
        lineItemId: payload.item.key,
        quantity: payload.quantity,
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
      const carts = await client.activeCart.get().execute();
      const result = this.factory.parseCartIdentifier(this.context, {
        key: carts.body.id,
        version: carts.body.version || 0,
      });

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
    const client = await this.getClient();
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
    const client = await this.getClient();
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

    const client = await this.getClient();
    const currentCart = await client.carts
      .withId({ ID: payload.cart.key })
      .get()
      .execute();
    const newCart = await client.carts
      .post({
        body: {
          currency: payload.newCurrency,
          locale: this.context.languageContext.locale,
        },
      })
      .execute();

    const newCartId = CommercetoolsCartIdentifierSchema.parse({
      key: newCart.body.id,
      version: newCart.body.version || 0,
    });

    const cartItemAdds: MyCartUpdateAction[] = currentCart.body.lineItems.map(
      (item) => ({
        action: 'addLineItem',
        sku: item.variant.sku || '',
        quantity: item.quantity,
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

  protected async createCart(): Promise<CartIdentifier> {
    const client = await this.getClient();
    const response = await client.carts
      .post({
        body: {
          currency: this.context.languageContext.currencyCode || 'USD',
          country: this.context.taxJurisdiction.countryCode || 'US',
          locale: this.context.languageContext.locale,
        },
        queryArgs: {
          expand: this.expandedCartFields,
        },
      })
      .execute();

    return this.factory.parseCartIdentifier(this.context, {
      key: response.body.id,
      version: response.body.version || 0,
    });
  }

  protected async applyActions(
    cart: CartIdentifier,
    actions: MyCartUpdateAction[],
  ): Promise<CartFactoryCartOutput<TFactory>> {
    const client = await this.getClient();
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
  protected async getClient() {
    const client = await this.commercetools.getClient();

    const clientWithProject = client.withProjectKey({
      projectKey: this.config.projectKey,
    });

    return {
      carts: clientWithProject.me().carts(),
      activeCart: clientWithProject.me().activeCart(),
      orders: clientWithProject.me().orders(),
    };
  }
}
